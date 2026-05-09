const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const Payment = require("../models/payment.model");

const app = express();
app.use(express.json());
require("../routes")(app);

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    const paymentQueue = require("../queues/payment.queue");
    await paymentQueue.close();
});

afterEach(async () => {
  // clear DB after each test to avoid state leaking between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("POST /webhooks/payment", () => {
  test("applies SUCCESS status to a PENDING payment", async () => {
    const payment = await Payment.create({
      amount: 100,
      currency: "USD",
      idempotencyKey: "wh-key-001",
      status: "PENDING",
    });

    const res = await request(app)
      .post("/webhooks/payment")
      .send({
        paymentId: payment._id,
        status: "SUCCESS",
        transactionId: "TXN_123",
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Webhook processed");

    const updated = await Payment.findById(payment._id);
    expect(updated.status).toBe("SUCCESS");
    expect(updated.gatewayTransactionId).toBe("TXN_123");
  });

  test("ignores webhook if payment is already finalized as SUCCESS", async () => {
    const payment = await Payment.create({
      amount: 100,
      currency: "USD",
      idempotencyKey: "wh-key-002",
      status: "SUCCESS",
    });

    const res = await request(app)
      .post("/webhooks/payment")
      .send({ paymentId: payment._id, status: "FAILED" });

    expect(res.body.status).toBe("SUCCESS"); // status should not change
  });

  test("ignores webhook if payment is already finalized as FAILED", async () => {
    const payment = await Payment.create({
      amount: 100,
      currency: "USD",
      idempotencyKey: "wh-key-003",
      status: "FAILED",
    });

    const res = await request(app)
      .post("/webhooks/payment")
      .send({ paymentId: payment._id, status: "SUCCESS" });

    expect(res.body.status).toBe("FAILED"); // status should not change
  });

  test("returns 400 if webhook status is invalid", async () => {
    const payment = await Payment.create({
      amount: 100,
      currency: "USD",
      idempotencyKey: "wh-key-004",
      status: "PENDING",
    });

    const res = await request(app)
      .post("/webhooks/payment")
      .send({ paymentId: payment._id, status: "UNKNOWN" });

    expect(res.status).toBe(400);
  });

  test("returns 404 if payment does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/webhooks/payment")
      .send({ paymentId: fakeId, status: "SUCCESS" });

    expect(res.status).toBe(404);
  });
});
