const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const Payment = require("../models/payment.model");
const fakeGateway = require("../gateway/fakeGateway");

const connection = new IORedis({ maxRetriesPerRequest: null });

const worker = new Worker(
  "paymentQueue",
  async (job) => {
    const { paymentId } = job.data;

    // free stuck payments (processing > 5 mins)
    const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000);
    await Payment.updateOne(
      { _id: paymentId, processing: true, updatedAt: { $lt: stuckThreshold } },
      { processing: false, status: "PENDING" },
    );

    // lock payment — prevent parallel processing
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, processing: false },
      { processing: true, status: "PROCESSING" },
      { returnDocument: "after" },
    );

    if (!payment) {
      console.log(
        JSON.stringify({
          event: "PAYMENT_SKIPPED",
          reason: "Already processing or not found",
          paymentId,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    console.log(
      JSON.stringify({
        event: "PAYMENT_PROCESSING_STARTED",
        paymentId,
        attempt: job.attemptsMade + 1,
        timestamp: new Date().toISOString(),
      }),
    );

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

      console.log(
        JSON.stringify({
          event: result.success ? "PAYMENT_SUCCESS" : "PAYMENT_FAILED",
          paymentId,
          attempt: job.attemptsMade + 1,
          transactionId: result.transactionId || null,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      payment.processing = false;
      payment.retryCount += 1;
      await payment.save();

      console.log(
        JSON.stringify({
          event: "PAYMENT_RETRY",
          paymentId,
          attempt: job.attemptsMade + 1,
          error: err.message,
          timestamp: new Date().toISOString(),
        }),
      );

      throw err; // BullMQ will retry
    }
  },
  { connection },
);

module.exports = worker;
