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
const API_BATCH_SIZE = 10; // Controls how many concurrent third-party HTTP requests are fired at once

const bulkAirtimeWorker = new Worker(
  "send-bulk-airtime",
  async (job) => {
    // Crucial fix: aligned object destructing with the payload dispatched from the route
    const {
      userID,
      phonenumber,
      paymentReference,
      payloads, // Contains array of items matching your route structure
    } = job.data;

    const lockKey = `airtime:worker:${paymentReference}`;
    const doneKey = `airtime:done:${paymentReference}`;

    // 1. Indempotency Check
    const isDone = await redisClient.get(doneKey);
    if (isDone) {
      logger.info(
        `Bulk Transaction ${paymentReference} already successfully processed.`,
      );
      return;
    }

    const lock = await redisClient.set(lockKey, process.pid, "NX", "EX", 300); // 5-minute processing window
    if (!lock) {
      logger.info(
        `Agent Bulk Airtime Transfer already processing ${paymentReference}`,
      );
      return;
    }

    try {
      let successfulPayoutsCount = 0;
      let vendorBalanceAfter = null;

      // console.log(payloads);
      // 2. Chunk processing loop to prevent hitting API rate limits or exhausting connection pools
      for (let i = 0; i < payloads.length; i += API_BATCH_SIZE) {
        const chunk = payloads.slice(i, i + API_BATCH_SIZE);

        await Promise.allSettled(
          chunk.map(async (item) => {
            // Support both data structural options sent by your route mappings securely
            const txInfo = item.transactionInfo || item;
            const airInfo = item.airtimeInfo || item;

            // console.log(item);

            let isItemSuccess = false;
            let apiResponse = null;

            try {
              // Fire external network request
              apiResponse = await sendAirtime(airInfo);
              const statusCode = apiResponse?.["status-code"];
              isItemSuccess = ["00", "09"].includes(statusCode);

              if (isItemSuccess && apiResponse?.balance_after) {
                vendorBalanceAfter = Number(apiResponse.balance_after);
              }
            } catch (apiErr) {
              logger.error(
                `API Outage for recipient ${airInfo.recipient}:`,
                apiErr,
              );
            }

            // Perform individual persistence changes safely using raw knex engine
            try {
              await knex("agent_transactions")
                .where({ id: txInfo?.id })
                .update({ status: isItemSuccess ? "completed" : "failed" });

              if (isItemSuccess) {
                successfulPayoutsCount++;

                await knex("notifications").insert({
                  id: generateId(),
                  user_id: userID, // Fixed variable reference from id -> userID
                  type: "airtime",
                  title: "Airtime Transfer",
                  body: `You have successfully recharged ${airInfo.recipient} with ${currencyFormatter(airInfo.amount)} of airtime. Commission earned: GHS ${txInfo.commission}.`,
                });

                await knex("activity_logs").insert({
                  user_id: userID,
                  title: `Bulk Transferred airtime to ${airInfo.recipient}`,
                  severity: "info",
                });
              } else {
                await knex("notifications").insert({
                  id: generateId(),
                  user_id: userID,
                  type: "airtime",
                  title: "Airtime Transfer Failed!",
                  body: `Your airtime transfer of ${currencyFormatter(airInfo.amount)} to ${airInfo.recipient} failed. Please try again later.`,
                });
              }
            } catch (dbErr) {
              logger.error(
                `Failed to update transaction status for ${txInfo.id}:`,
                dbErr,
              );
            }
          }),
        );
      }

      // 3. Post-execution safety workflows
      if (vendorBalanceAfter !== null && vendorBalanceAfter < 1000) {
        insufficientBalanceWarning(vendorBalanceAfter).catch(logger.error);
      }

      // Flag batch process as complete in Redis
      await redisClient.set(doneKey, "1", "EX", 86400);
      await redisClient.del(lockKey);

      const totalItemsCount = payloads.length;

      await emitGeneralInfo({
        emitter: "send-bulk-airtime",
        userId: userID || phonenumber || paymentReference,
        data: {
          success: successfulPayoutsCount > 0,
          title: "Bulk Airtime Summary",
          body: `Bulk process finished. Successfully processed ${successfulPayoutsCount} out of ${totalItemsCount} airtime orders. Batch Ref: ${paymentReference}.`,
        },
      }).catch(logger.error);

      logger.info(
        `Bulk airtime process complete for batch reference ${paymentReference}. Total success: ${successfulPayoutsCount}/${totalItemsCount}`,
      );
    } catch (error) {
      logger.error(`Fatal runtime error inside bulk airtime worker:`, error);
      await redisClient.del(lockKey);

      await emitGeneralInfo({
        emitter: "send-bulk-airtime",
        userId: userID || phonenumber || paymentReference,
        data: {
          success: false,
          title: "Bulk Airtime Processing Error",
          body: `A system error interrupted the bulk airtime processing cycle.`,
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
bulkAirtimeWorker.on("completed", (job) => {
  logger.info(`Bulk airtime worker completed ${job.id}`);
});

bulkAirtimeWorker.on("failed", (job, error) => {
  logger.error(`Bulk airtime worker failed ${job?.id || "unknown"}`, error);
});

module.exports = bulkAirtimeWorker;
