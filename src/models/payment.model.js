const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    amount: Number,
    currency: String,

    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },

    idempotencyKey: {
      type: String,
      unique: true,
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    processing: {
      type: Boolean,
      default: false,
    },
    gatewayTransactionId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
