# Payment Processing System

A backend system that simulates real-world payment gateway behavior, built with Node.js, Express, MongoDB, Redis, and BullMQ.

---

## Tech Stack

- **Node.js** + **Express** — REST API
- **MongoDB** + **Mongoose** — data persistence
- **Redis** + **BullMQ** — async job queue with retry logic
- **Jest** + **Supertest** — testing

---

## Features

- Payment lifecycle management (PENDING → PROCESSING → SUCCESS / FAILED)
- Idempotency — duplicate requests return the same payment
- Retry logic with exponential backoff (via BullMQ)
- Concurrency control — prevents parallel processing of the same payment
- External gateway simulation with random success, failure, and timeouts
- Webhook handling — ignores duplicate or conflicting callbacks
- Structured JSON logging for all lifecycle events

---

## Project Structure

```
src/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/
│   ├── payment.controller.js  # create & get payment
│   └── webhook.controller.js  # handle gateway callbacks
├── gateway/
│   └── fakeGateway.js         # simulated external provider
├── models/
│   └── payment.model.js       # Mongoose schema
├── queues/
│   └── payment.queue.js       # BullMQ queue setup
├── routes/
│   ├── index.js
│   ├── payment.routes.js
│   └── webhook.routes.js
├── workers/
│   └── payment.worker.js      # job processor
├── __tests__/
│   ├── payment.test.js
│   └── webhook.test.js
└── app.js
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

### Installation

```bash
git clone <repo-url>
cd payment-system
npm install
```

### Environment

Create a `.env` file (see `.env.example`):

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/payment-system
REDIS_URL=redis://localhost:6379
```

### Run

```bash
npm run dev
```

---

## API Reference

### Create a payment

```
POST /payments
```

**Headers:**

| Header | Required | Description |
|---|---|---|
| `Idempotency-Key` | Yes | Unique key to prevent duplicate payments |

**Body:**

```json
{
  "amount": 100,
  "currency": "USD"
}
```

**Response:**

```json
{
  "_id": "...",
  "amount": 100,
  "currency": "USD",
  "status": "PENDING",
  "idempotencyKey": "your-unique-key",
  "createdAt": "..."
}
```

---

### Get payment status

```
GET /payments/:id
```

**Response:**

```json
{
  "_id": "...",
  "status": "SUCCESS",
  "gatewayTransactionId": "TXN_1234567890"
}
```

---

### Webhook callback

```
POST /webhooks/payment
```

**Body:**

```json
{
  "paymentId": "...",
  "status": "SUCCESS",
  "transactionId": "TXN_123"
}
```

> Duplicate or conflicting webhooks on already-finalized payments are safely ignored.

---

## Payment States

```
PENDING → PROCESSING → SUCCESS
                     → FAILED (retried up to 3 times with exponential backoff)
```

---

## Testing

```bash
npm test
```

Runs 11 tests covering:

- Missing idempotency key returns 400
- Missing amount/currency returns 400
- Successful payment creation
- Duplicate idempotency key returns same payment
- Get payment by ID
- Get non-existent payment returns 404
- Webhook applies SUCCESS to a PENDING payment
- Webhook ignored if payment already SUCCESS
- Webhook ignored if payment already FAILED
- Invalid webhook status returns 400
- Webhook on non-existent payment returns 404

---

## Design Decisions

**Idempotency** — checked at the controller level using a unique index on `idempotencyKey`. Any repeated request with the same key returns the existing payment without creating a new one or triggering a new job.

**Concurrency control** — the worker uses an atomic `findOneAndUpdate` with `processing: false` as a condition. Only one worker instance can acquire the lock; others skip silently.

**Retry logic** — BullMQ handles retries with exponential backoff (base delay 2000ms, up to 3 attempts). On each failure the worker throws, and BullMQ re-queues the job automatically.

**Stuck payment recovery** — on each job attempt, payments that have been in `processing: true` for more than 5 minutes are reset to `PENDING` before the lock is re-acquired. This handles crash recovery without a separate cron job.

**Webhook safety** — updates use `$nin: ["SUCCESS", "FAILED"]` as a condition, making concurrent webhook deliveries safe. The first one wins; all subsequent ones are no-ops.