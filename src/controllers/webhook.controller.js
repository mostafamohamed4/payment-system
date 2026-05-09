const Payment = require("../models/payment.model");

const paymentWebhook = async (req, res) => {
  try {
    const { paymentId, status, transactionId } = req.body;

    console.log(
      JSON.stringify({
        event: "WEBHOOK_RECEIVED",
        paymentId,
        status,
        timestamp: new Date().toISOString(),
      }),
    );

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // duplicate or conflicting — already finalized
    if (payment.status === "SUCCESS" || payment.status === "FAILED") {
      console.log(
        JSON.stringify({
          event: "WEBHOOK_IGNORED",
          reason: "Already finalized",
          paymentId,
          currentStatus: payment.status,
          timestamp: new Date().toISOString(),
        }),
      );
      return res.json({ message: "Already finalized", status: payment.status });
    }

    if (status !== "SUCCESS" && status !== "FAILED") {
      return res.status(400).json({ message: "Invalid status" });
    }

    await Payment.updateOne(
      { _id: paymentId, status: { $nin: ["SUCCESS", "FAILED"] } },
      { $set: { status, gatewayTransactionId: transactionId || null } },
    );

    console.log(
      JSON.stringify({
        event: "WEBHOOK_APPLIED",
        paymentId,
        newStatus: status,
        timestamp: new Date().toISOString(),
      }),
    );

    res.json({ message: "Webhook processed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { paymentWebhook };
