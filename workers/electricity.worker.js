const { Worker } = require("bullmq");
const redisClient = require("../config/redisClient");
const logger = require("../utils/logger");
const { redisConnectionOptions } = require("../config/configurations");
const { emitGeneralInfo } = require("../config/emitters");
const { uploadReceiptFile } = require("../config/uploadFile");
const {
  generatePrepaidTemplate,
} = require("../config/generateVoucherTemplate");
const { generatePrepaidReceipt } = require("../config/generatePDF");
const { sendSMS } = require("../config/sms");
const { sendPrepaidEmail } = require("../config/mail");
const currencyFormatter = require("../config/currencyFormatter");

const CONCURRENCY = 5;

const electricityWorker = new Worker(
  "send-electricity",
  async (job) => {
    const { userId, transactionId, paymentReference, transaction } = job.data;

    const lockKey = `electricity:worker:${transactionId}`;
    const doneKey = `electricity:done:${transactionId}`;

    // 1. Check if already processed or processing
    const isDone = await redisClient.get(doneKey);
    if (isDone) {
      logger.info(
        `Transaction ${transactionId} already successfully processed.`,
      );
      return;
    }

    const lock = await redisClient.set(lockKey, process.pid, "NX", "EX", 120);
    if (!lock) {
      logger.info(
        `Agent Electricity Transfer already processing ${transactionId}`,
      );
      return;
    }

    const rechargeToken = transaction?.token
      ?.replace(/\s|-/g, "")
      .match(/.{1,4}/g)
      ?.join("-");

    const message = `METER NO: ${transaction?.number} (${transaction?.name}) has successfully purchased ECG Prepaid Units at an amount of ${currencyFormatter(transaction?.amount)}. Your Recharge Token is: ${rechargeToken}.
    REF:ID: ${transaction?.transactionId}.`;

    if (transaction.status === "completed") {
      // Send Mail and SMS to the User
      if (transaction?.phoneNumber) {
        await sendSMS(message, transaction?.phoneNumber);
      }
      console.log("SMS sent successfully");
    }

    let isSuccess = false;

    try {
      // ==================================================
      // GENERATE PDF
      // ==================================================
      const template = await generatePrepaidTemplate(transaction);
      console.log("Template generated successfully");

      const result = await generatePrepaidReceipt(
        template,
        transaction?.transactionId,
      );
      console.log("PDF generated successfully");

      if (result !== "done") {
        throw new Error("Voucher PDF generation failed");
      }

      isSuccess = true;

      // ==================================================
      // UPLOAD PDF
      // ==================================================

      const downloadLink = await uploadReceiptFile(
        `${transaction?.transactionId}.pdf`,
      );
      console.log("PDF uploaded successfully");

      if (!downloadLink) {
        throw new Error("Upload failed");
      }

      transaction.receiptUrl = downloadLink;

      await sendPrepaidEmail(transaction);
      console.log("Email sent successfully");

      await emitGeneralInfo({
        emitter: "ticket-generation",
        userId: userId || transaction?.phoneNumber || paymentReference,
        data: downloadLink,
      });

      // 5. Post-transaction operations
      if (isSuccess) {
        // Set completed flag to guarantee idempotency
        await redisClient.set(doneKey, "1", "EX", 86400);
        // Release processing lock safely
        await redisClient.del(lockKey);
      }

      await emitGeneralInfo({
        emitter: "send-electricity",
        userId: userId || transaction?.phoneNumber || paymentReference,
        data: {
          success: isSuccess,
          title: "Electricity Transfer",
          body: isSuccess
            ? message
            : `Electricity Recharge Failed. Try again later!`,
        },
      }).catch(logger.error);

      if (!isSuccess) {
        throw new Error(`Ticket Generation Error! Please try again later.`);
      }

      logger.info(`Electricity transfer successful ${transactionId}`);
    } catch (error) {
      console.error("Error processing electricity worker:", error);
      logger.error(
        `Error processing electricity worker for transaction ${transactionId}:`,
        error,
      );

      // Release lock on failure so the job can be retried by BullMQ if configured
      await redisClient.del(lockKey);

      await emitGeneralInfo({
        emitter: "send-electricity",
        userId: userId || transaction?.phoneNumber || paymentReference,
        data: {
          success: false,
          title: "Electricity Transfer",
          body: `Electricity Recharge Failed. Try again later!`,
        },
      }).catch(logger.error);

      throw error;
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: CONCURRENCY,
    removeOnComplete: {
      age: 86400,
      count: 1000,
    },
    removeOnFail: false,
  },
);

// ==========================================
// EVENT LISTENERS
// ==========================================
electricityWorker.on("completed", (job) => {
  logger.info(`Electricity worker completed ${job.id}`);
});

electricityWorker.on("failed", (job, error) => {
  logger.error(`Electricity worker failed ${job?.id || "unknown"}`, error);
});


module.exports = electricityWorker;
