// queues/whatsapp.queue.js

const { Queue } = require("bullmq");

const connectionOptions = {
  url: process.env.REDIS_HOST_EXT,
  maxRetriesPerRequest: null,
};

const airtimeQueue = new Queue("send-airtime", {
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


const bulkAirtimeQueue = new Queue("send-bulk-airtime", {
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
  airtimeQueue,
  bulkAirtimeQueue,


};
