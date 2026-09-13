const { Worker } = require("bullmq");
const redisClient = require("../config/redisClient");
const logger = require("../utils/logger");
const knex = require("../db/knex");
const generateId = require("../config/generateId");
const { redisConnectionOptions } = require("../config/configurations");
const { emitGeneralInfo } = require("../config/emitters");
const currencyFormatter = require("../config/currencyFormatter");
const { insufficientBalanceWarning } = require("../utils/system-info");
const { sendBundle } = require("../config/sendMoney");

const CONCURRENCY = 5;

const bundleWorker = new Worker(
  "send-bundle",
  async (job) => {
    const {
      userID,
      transactionId,
      paymentReference,
      phonenumber,
      bundleInfo, // Contains code, network, reference, and recipient
      amount,
    } = job.data;

    // Fixed safe access paths: Extract details cleanly from the existing payload data
    const targetRecipient = bundleInfo?.recipient || "Recipient";
    const bundlePlanCode = bundleInfo?.data_code || "Data Bundle";

    const lockKey = `bundle:worker:${transactionId}`;
    const doneKey = `bundle:done:${transactionId}`;

    // 1. Idempotency Check
    const isDone = await redisClient.get(doneKey);
    if (isDone) {
      logger.info(`Transaction ${transactionId} already successfully processed.`);
      return;
    }

    const lock = await redisClient.set(lockKey, process.pid, "NX", "EX", 120);
    if (!lock) {
      logger.info(`Agent Bundle Transfer already processing ${transactionId}`);
      return;
    }

    let isSuccess = false;
    let response;

    try {
      // 2. Call External API OUTSIDE of the DB Transaction to protect connection pools
      response = await sendBundle(bundleInfo);
      const statusCode = response?.["status-code"];
      isSuccess = ["00", "09"].includes(statusCode);

      // 3. Atomically update transaction status and write logs
      await knex.transaction(async (trx) => {
        await trx("agent_transactions")
          .where({ id: transactionId })
          .update({ status: isSuccess ? "completed" : "failed" });

        if (isSuccess) {
          await trx("notifications").insert({
            id: generateId(),
            user_id: userID,
            type: "bundle",
            title: "Bundle Transfer",
            body: `You have successfully recharged ${targetRecipient} with bundle plan ${bundlePlanCode}. Charged: ${currencyFormatter(amount)}.`,
          });

          await trx("activity_logs").insert({
            user_id: userID,
            title: `Transferred bundle ${bundlePlanCode} to ${targetRecipient}`,
            severity: "info",
          });
        } else {
          await trx("notifications").insert({
            id: generateId(),
            user_id: userID,
            type: "bundle",
            title: "Bundle Transfer Failed!",
            body: `Your bundle transfer of ${currencyFormatter(amount)} to ${targetRecipient} failed. Please try again later.`,
          });
        }
      });

      // 4. Post-transaction operations
      if (isSuccess) {
        if (response?.balance_after && Number(response.balance_after) < 1000) {
          insufficientBalanceWarning(response.balance_after).catch(logger.error);
        }

        // Lock down idempotency flags on successful delivery
        await redisClient.set(doneKey, "1", "EX", 86400);
        await redisClient.del(lockKey);
      }

      await emitGeneralInfo({
        emitter: "send-bundle",
        userId: userID || phonenumber || paymentReference,
        data: {
          success: isSuccess,
          title: "Bundle Transfer",
          body: isSuccess
            ? `You have successfully recharged ${targetRecipient} with plan ${bundlePlanCode}. Charged: ${currencyFormatter(amount)}. Trnx ID: ${transactionId}`
            : `Bundle Recharge Failed. Try again later!`,
        },
      }).catch(logger.error);

      if (!isSuccess) {
        throw new Error(`Bundle provider returned non-success code: ${statusCode}`);
      }

      logger.info(`Bundle transfer successful ${transactionId}`);
    } catch (error) {
      logger.error(`Error processing bundle worker for transaction ${transactionId}:`, error);

      // Ensure processing lock releases on failures so the item is retryable
      await redisClient.del(lockKey);

      await emitGeneralInfo({
        emitter: "send-bundle",
        userId: userID || phonenumber || paymentReference,
        data: {
          success: false,
          title: "Bundle Transfer",
          body: `Bundle Recharge Failed. Try again later!`,
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
bundleWorker.on("completed", (job) => {
  logger.info(`Bundle worker completed ${job.id}`);
});

bundleWorker.on("failed", (job, error) => {
  logger.error(`Bundle worker failed ${job?.id || "unknown"}`, error);
});

module.exports = bundleWorker;
