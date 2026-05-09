const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const paymentQueue = new Queue("paymentQueue", {
  connection,
});

module.exports = paymentQueue;
