const express = require("express");

const router = express.Router();

const { paymentWebhook } = require("../controllers/webhook.controller");

router.post("/payment", paymentWebhook);

module.exports = router;
