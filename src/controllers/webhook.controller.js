const Payment = require("../models/payment.model");

const paymentWebhook = async (req, res) => {
  try {
    const { paymentId, status, transactionId } = req.body;

    console.log("Webhook received:", req.body);

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    if (payment.status === "SUCCESS") {
   return res.json({
     status: payment.status,
   });
    }

    if (status !== "SUCCESS" && status !== "FAILED") {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    await Payment.updateOne(
      {
        _id: paymentId,
        status: { $ne: "SUCCESS" },
      },
      {
        $set: {
          status,
          gatewayTransactionId: transactionId,
        },
      },
    );

    res.json({
      message: "Webhook processed",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

module.exports = {
  paymentWebhook,
};
