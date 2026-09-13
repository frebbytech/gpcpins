
const { Worker } = require("bullmq");
const redisClient = require("../config/redisClient");
const logger = require("../utils/logger");
const knex = require("../db/knex");
const generateId = require("../config/generateId");
const { redisConnectionOptions } = require("../config/configurations");
const { emitGeneralInfo } = require("../config/emitters");
const currencyFormatter = require("../config/currencyFormatter");
const { insufficientBalanceWarning } = require("../utils/system-info");
const { sendAirtime } = require("../config/sendMoney");

const CONCURRENCY = 5;

const airtimeWorker = new Worker(
  "send-airtime",
  async (job) => {
    const {
      userID,
      phonenumber,
      transactionId,
      paymentReference,
      recipient,
      network,
      amount,
      commissionData,
    } = job.data;

    const lockKey = `airtime:worker:${transactionId}`;
    const doneKey = `airtime:done:${transactionId}`;

    // 1. Check if already processed or processing
    const isDone = await redisClient.get(doneKey);
    if (isDone) {
      logger.info(`Transaction ${transactionId} already successfully processed.`);
      return;
    }

    const lock = await redisClient.set(lockKey, process.pid, "NX", "EX", 120);
    if (!lock) {
      logger.info(`Agent Airtime Transfer already processing ${transactionId}`);
      return;
    }

    let isSuccess = false;
    let response;

    try {
      // 2. Map Network Type
      const networkMap = { MTN: 4, Vodafone: 6, AirtelTigo: 1 };
      const airtimeInfo = {
        recipient,
        amount,
        network: networkMap[network] || 0,
        transaction_reference: paymentReference,
      };

      // 3. Call External API OUTSIDE of the DB Transaction to prevent connection pool starvation
      response = await sendAirtime(airtimeInfo);
      const statusCode = response?.["status-code"];
      isSuccess = ["00", "09"].includes(statusCode);

      const commission = (commissionData?.rate / 100) * amount;
      const payableAmount = amount - commission;

      // 4. Perform Atomic Database Updates inside a Single Transaction
      await knex.transaction(async (trx) => {
        const transactionInfo = {
          info: JSON.stringify({
            recipient,
            ref: paymentReference,
            amount: payableAmount,
          }),
          amount: isSuccess ? payableAmount : amount,
          commission: isSuccess ? commission : 0,
          status: isSuccess ? "completed" : "failed", // Fixed typo "falied"
        };

        await trx("agent_transactions")
          .where({ id: transactionId })
          .update(transactionInfo);

        if (isSuccess) {
          await trx("notifications").insert({
            id: generateId(),
            user_id: userID,
            type: "airtime",
            title: "Airtime Transfer",
            body: `You have successfully recharged ${recipient} with ${currencyFormatter(amount)} of airtime. Commission: ${currencyFormatter(commission)}.`,
          });

          await trx("activity_logs").insert({
            user_id: userID,
            title: `Transferred airtime to ${recipient}`,
            severity: "info",
          });
        } else {
          await trx("notifications").insert({
            id: generateId(),
            user_id: userID,
            type: "airtime",
            title: "Airtime Transfer Failed!",
            body: `Your airtime transfer of ${currencyFormatter(amount)} to ${recipient} failed. Please try again later.`,
          });
        }
      });

      // 5. Post-transaction operations
      if (isSuccess) {
        if (Number(response?.balance_after) < 1000) {
          insufficientBalanceWarning(response.balance_after).catch(logger.error);
        }

        // Set completed flag to guarantee idempotency
        await redisClient.set(doneKey, "1", "EX", 86400);
        // Release processing lock safely
        await redisClient.del(lockKey); 
      }

      await emitGeneralInfo({
        emitter: "send-airtime",
        userId: userID || phonenumber || paymentReference,
        data: {
          success: isSuccess,
          title: "Airtime Transfer",
          body: isSuccess 
            ? `You have successfully recharged ${recipient} with GHS ${amount} of airtime. Trnx ID: ${transactionId}.`
            : `Airtime Recharge Failed. Try again later!`,
        },
      }).catch(logger.error);

      if (!isSuccess) {
        throw new Error(`Airtime provider returned non-success code: ${statusCode}`);
      }

      logger.info(`Airtime transfer successful ${transactionId}`);
    } catch (error) {
      logger.error(`Error processing airtime worker for transaction ${transactionId}:`, error);
      
      // Release lock on failure so the job can be retried by BullMQ if configured
      await redisClient.del(lockKey);

      await emitGeneralInfo({
        emitter: "send-airtime",
        userId: userID || phonenumber || paymentReference,
        data: {
          success: false,
          title: "Airtime Transfer",
          body: `Airtime Recharge Failed. Try again later!`,
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
airtimeWorker.on("completed", (job) => {
  logger.info(`Airtime worker completed ${job.id}`);
});

airtimeWorker.on("failed", (job, error) => {
  logger.error(`Airtime worker failed ${job?.id || 'unknown'}`, error);
});

module.exports = airtimeWorker;

