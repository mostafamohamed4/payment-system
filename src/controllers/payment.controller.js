const Payment = require("../models/payment.model");
const paymentQueue = require("../queues/payment.queue");

const createPayment = async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const idempotencyKey = req.headers["idempotency-key"];

    if (!amount || !currency) {
      return res.status(400).json({
        message: "Invalid input",
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        message: "Idempotency-Key is required",
      });
    }

    const existing = await Payment.findOne({ idempotencyKey });

    if (existing) {
      return res.json(existing);
    }

    const payment = await Payment.create({
      amount,
      currency,
      idempotencyKey,
      status: "PENDING",
    });

    await paymentQueue.add(
      "process-payment",
      {
        paymentId: payment._id,
      },
      {
        jobId: payment._id.toString(),
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    );

    res.json(payment);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    res.json(payment);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

module.exports = {
  createPayment,
  getPaymentStatus,
};
