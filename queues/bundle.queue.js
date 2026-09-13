// queues/whatsapp.queue.js

const { Queue } = require("bullmq");

const connectionOptions = {
  url: process.env.REDIS_HOST_EXT,
  maxRetriesPerRequest: null,
};

const bundleQueue = new Queue("send-bundle", {
  connection: connectionOptions,

  defaultJobOptions: {
    attempts: 1,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: 1000,

    removeOnFail: false,
  },
});



module.exports = {
  bundleQueue,
};
