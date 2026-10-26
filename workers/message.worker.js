// workers/message.worker.js
const { Worker } = require("bullmq");
// const redisClient = require("../config/redisClient");
const { sendText } = require("../services/message.sender");
const { redisConnectionOptions } = require("../config/configurations");


const worker = new Worker(
  "messages",
  async (job) => {
    const { sessionId, phone, message } = job.data;

    // const { message_uuid, sessionId, phone, message } = job.data;

    // // 1. idempotency lock
    // const lockKey = `msg:${message_uuid}`;
    // const lock = await redisClient.set(lockKey, "1", "NX", "EX", 3600);

    // if (!lock) return;

    try {
      await sendText(sessionId, phone, message);
    } catch (err) {
      console.log(err);
      throw err;
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 10,
  },
);

worker.on("completed", (job) => {
  console.log("Job completed:", job?.id);
});

worker.on("failed", (job, err) => {
  console.error("Job failed:", job?.id, err.message);
});

module.exports = worker;
