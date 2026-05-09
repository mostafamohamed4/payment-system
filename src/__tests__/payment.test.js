const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");

// mock the queue to avoid sending real jobs
jest.mock("../queues/payment.queue", () => ({
  add: jest.fn().mockResolvedValue({}),
}));

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
  
});

afterEach(async () => {
  // clear DB after each test to avoid state leaking between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("POST /payments", () => {
  test("returns 400 if idempotency-key header is missing", async () => {
    const res = await request(app)
      .post("/payments")
      .send({ amount: 100, currency: "USD" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Idempotency-Key is required");
  });

  test("returns 400 if amount or currency is missing", async () => {
    const res = await request(app)
      .post("/payments")
      .set("idempotency-key", "key-001")
      .send({ amount: 100 }); // missing currency

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid input");
  });

  test("creates a payment successfully with status PENDING", async () => {
    const res = await request(app)
      .post("/payments")
      .set("idempotency-key", "key-002")
      .send({ amount: 100, currency: "USD" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.amount).toBe(100);
    expect(res.body.currency).toBe("USD");
  });

  test("returns the same payment for duplicate idempotency-key", async () => {
    const first = await request(app)
      .post("/payments")
      .set("idempotency-key", "key-003")
      .send({ amount: 100, currency: "USD" });

    const second = await request(app)
      .post("/payments")
      .set("idempotency-key", "key-003")
      .send({ amount: 100, currency: "USD" });

    expect(first.body._id).toBe(second.body._id);
  });
});

describe("GET /payments/:id", () => {
  test("returns the payment if it exists", async () => {
    const created = await request(app)
      .post("/payments")
      .set("idempotency-key", "key-004")
      .send({ amount: 200, currency: "EGP" });

    const res = await request(app).get(`/payments/${created.body._id}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(created.body._id);
  });

  test("returns 404 if payment does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/payments/${fakeId}`);

    expect(res.status).toBe(404);
  });
});
