const { Worker } = require("bullmq");
const _ = require("lodash");
const redisClient = require("../config/redisClient");
const logger = require("../utils/logger");
const knex = require("../db/knex");
const { safeJSON } = require("../config/helpers");
const { imageUrlToBase64 } = require("../config/ImageToBase64");
const processVouchers = require("../config/processVouchers");
const { uploadVoucherFile } = require("../config/uploadFile");
const generateId = require("../config/generateId");
const { sendTicketMail } = require("../config/mail");
const { messageQueue } = require("../queues/message.queue");
const { redisConnectionOptions } = require("../config/configurations");
const { emitGeneralInfo } = require("../config/emitters");
const currencyFormatter = require("../config/currencyFormatter");
const { formatDateTime } = require("../config/dateConfigs");
const { getInternationalMobileFormat } = require("../config/PhoneCode");

const CONCURRENCY = 10;

const voucherWorker = new Worker(
  "voucher-generation",

  async (job) => {
    const { transactionId, userID } = job.data;

    const lockKey = `voucher:worker:${transactionId}`;

    const lock = await redisClient.set(lockKey, process.pid, "NX", "EX", 600);

    if (!lock) {
      logger.info(`Voucher already processing ${transactionId}`);
      return;
    }

    let trx;

    try {
      trx = await knex.transaction();

      // ==================================================
      // FETCH TRANSACTION
      // ==================================================

      const transaction = await trx("vw_payments_voucher_transactions")
        .select(
          "paymentId",
          "paymentReference",
          "id",
          "info",
          "email",
          "phonenumber",
          "vouchers",
          "status",
          "createdAt",
          "updatedAt",
        )
        .where("id", transactionId)
        .first();

      if (!transaction) {
        throw new Error(`Transaction not found ${transactionId}`);
      }

      const {
        paymentId,
        paymentReference,
        id,
        info,
        email,
        phonenumber,
        vouchers,
        status,
        createdAt,
        updatedAt,
      } = transaction;

      const userInfo = safeJSON(info);

      const userVoucher = safeJSON(vouchers);

      // ==================================================
      // IDEMPOTENCY CHECK
      // ==================================================

      if (userInfo?.downloadLink) {
        logger.info(`Voucher already generated ${id}`);

        await trx.commit();
        return;
      }

      // ==================================================
      // MARK PROCESSING
      // ==================================================

      //   await trx("voucher_transactions")
      //     .where({
      //       id,
      //     })
      //     .update({
      //       status: "processing",
      //       updated_at: knex.fn.now(),
      //     });

      // ==================================================
      // FETCH VOUCHERS
      // ==================================================

      const soldVouchers = await trx("vouchers")
        .join("categories", "vouchers.category_id", "categories.id")
        .whereIn("vouchers.id", userVoucher)
        .select(
          "vouchers.id",
          "vouchers.pin",
          "vouchers.serial",
          "categories.id as categoryId",
          "categories.name as voucherType",
          "categories.price",
          "categories.details",
        );

      if (_.isEmpty(soldVouchers)) {
        throw new Error("No vouchers found");
      }

      const details = safeJSON(soldVouchers[0]?.details);

      // ==================================================
      // LOGO
      // ==================================================

      let base64Logo = "";

      if (details?.logo) {
        try {
          base64Logo = await imageUrlToBase64(details.logo);
        } catch (err) {
          console.log(err)
          logger.warn("Logo conversion failed");
        }
      }

      // ==================================================
      // BUILD PDF DATA
      // ==================================================

      const modifiedVoucher = soldVouchers.map(
        ({ voucherType, price, details, serial, pin, id }) => {
          const info = safeJSON(details);

          return {
            id,
            voucherType,
            price: currencyFormatter(
              userInfo?.category === "waec" ? info?.price : price,
            ),
            serial,
            pin,
            status: "sold",
          };
        },
      );

      const generatedTransaction = {
        info: userInfo,
        id,
        createdAt,
        updatedAt,
        formType: details?.formType || "",
        dataURL: details?.voucherURL,
        agentName: userInfo?.user?.name || "GPC Customer",
        agentPhoneNumber: phonenumber,
        agentEmail: email,
        formattedDate: formatDateTime(createdAt),
        vouchers: modifiedVoucher,
        logo: base64Logo,
        status,
      };

      // ==================================================
      // GENERATE PDF
      // ==================================================

      const result = await processVouchers(generatedTransaction);

      if (result !== "done") {
        throw new Error("Voucher PDF generation failed");
      }

      // ==================================================
      // UPLOAD PDF
      // ==================================================

      const downloadLink = await uploadVoucherFile(`${id}.pdf`);

      if (!downloadLink) {
        throw new Error("Upload failed");
      }

      await emitGeneralInfo({
        emitter: "ticket-generation",
        userId: userID || phonenumber || paymentReference,
        data: downloadLink,
      });

      // ==================================================
      // UPDATE DB
      // ==================================================

      await trx("voucher_transactions")
        .where({
          id,
        })
        .update({
          //   status: "completed",
          info: JSON.stringify({
            ...userInfo,
            downloadLink,
          }),
        //   updated_at: knex.fn.now(),
        });

      await trx("payments")
        .where({
          id: paymentId,
        })
        .update({
          is_processed: true,
          updated_at: knex.fn.now(),
        });

      if (userID) {
        await trx("notifications").insert({
          id: generateId(),
          user_id: userID,
          type: "voucher",
          title: `${modifiedVoucher[0]?.voucherType} Voucher`,
          body: "Voucher generated successfully",
          link: downloadLink,
        });
      }

      await trx.commit();

      // ==================================================
      // REDISCLIENTredisClient COMPLETION FLAG
      // ==================================================

      await redisClient.set(`voucher:done:${id}`, "1", "EX", 86400);

      // ==================================================
      // EMAIL
      // ==================================================

      if (email) {
        await sendTicketMail(id, email, modifiedVoucher[0]?.voucherType);
      }

      // ==================================================
      // WHATSAPP
      // ==================================================

      if (phonenumber) {
        await messageQueue.add(
          "send-document",
          {
            sessionId: process.env.WHATSAPP_SESSION_ID,
            type: "send-document",
            phone: getInternationalMobileFormat(phonenumber),
            message: downloadLink,
            downloadLink,
            fileName: `${id}.pdf`,
            caption: `Here is your ${modifiedVoucher[0]?.voucherType} voucher.`,
          },
          {
            jobId: `voucher-wa-${id}`,
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
            removeOnComplete: 100,
          },
        );
      }

      logger.info(`Voucher generated successfully ${id}`);
    } catch (error) {
      logger.error(error);

      if (trx) {
        await trx.rollback();
      }

      // ==========================================
      // MARK FAILED
      // ==========================================

      //   try {
      //     await knex("voucher_transactions")
      //       .where({
      //         id: transactionId,
      //       })
      //       .update({
      //         status: "failed",
      //       });
      //   } catch {}

      throw error;
    } finally {
      await redisClient.del(lockKey);
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
// COMPLETED
// ==========================================

voucherWorker.on("completed", (job) => {
  logger.info(`Voucher worker completed ${job.id}`);
});

// ==========================================
// FAILED
// ==========================================

voucherWorker.on("failed", async (job, error) => {
  logger.error(`Voucher worker failed ${job?.id}`, error);

  //   if (job && job.attemptsMade >= job.opts.attempts) {
  //     await voucherDLQ.add("voucher-failed", {
  //       transactionId: job.data.transactionId,
  //       payload: job.data,
  //       error: error.message,
  //       stack: error.stack,
  //       failedAt: new Date().toISOString(),
  //     });
  //   }
});

module.exports = voucherWorker;
