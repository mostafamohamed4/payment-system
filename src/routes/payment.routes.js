const express = require("express");
const router = express.Router();

const { createPayment, getPaymentStatus } = require("../controllers/payment.controller");

router.post("/", createPayment);
router.get("/:id", getPaymentStatus);
module.exports = router;
