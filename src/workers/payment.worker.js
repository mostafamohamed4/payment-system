const { Worker } = require("bullmq");
const IORedis = require("ioredis");

const Payment = require("../models/payment.model");
const fakeGateway = require("../gateway/fakeGateway");

const connection = new IORedis({
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "paymentQueue",

  async (job) => {
    const { paymentId } = job.data;

    // lock payment
    const payment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        processing: false,
      },
      {
        processing: true,
        status: "PROCESSING",
      },
      {
        new: true,
      },
    );

    if (!payment) {
      return;
    }

    try {
      const result = await fakeGateway();

      if (result.success) {
        payment.status = "SUCCESS";
        payment.gatewayTransactionId = result.transactionId;
      } else {
        payment.status = "FAILED";
      }

      payment.processing = false;

      await payment.save();
    } catch (err) {
      payment.processing = false;

      payment.retryCount += 1;

      await payment.save();

      throw err;
    }
  },

  {
    connection,
  },
);

module.exports = worker;
