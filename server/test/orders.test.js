import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.CASHFREE_MODE = 'mock';
process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_HOLD_MINUTES = '15';

const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { Product } = await import('../src/models/Product.js');
const { Order } = await import('../src/models/Order.js');
const { User } = await import('../src/models/User.js');
const { gateway } = await import('../src/services/cashfree.js');
const { sweepExpiredHolds } = await import('../src/services/payments.js');

const app = createApp();
const address = { fullName: 'Asha Patel', phone: '98765 43210', line1: '12, Lake View Road', city: 'Ahmedabad', pincode: '380015' };
let n = 0;
const key = () => `test-key-${++n}-${crypto.randomUUID()}`;

async function makeProduct(stock, price = 100) {
  n += 1;
  return Product.create({ name: `Item ${n}`, slug: `item-${n}`, category: 'Fruits', price, unit: '1 kg', stock });
}

async function loggedInAgent() {
  const agent = request.agent(app);
  n += 1;
  const res = await agent.post('/api/auth/register').send({ name: 'Asha', email: `asha${n}@example.com`, password: 'password123' });
  assert.equal(res.status, 201);
  return agent;
}

function order(agent, items, paymentMethod = 'cod', idempotencyKey = key()) {
  return agent.post('/api/orders').send({ items, address, paymentMethod, idempotencyKey });
}

before(async () => {
  await connectDB('');
  await Promise.all([User.init(), Product.init(), Order.init()]);
});
after(disconnectDB);
beforeEach(async () => {
  await Promise.all([Product.deleteMany({}), Order.deleteMany({})]);
});

describe('placing orders (stock and ACID)', () => {
  test('an order without login is rejected and changes nothing', async () => {
    const p = await makeProduct(5);
    const res = await request(app).post('/api/orders').send({ items: [{ productId: p.id, qty: 1 }], address, paymentMethod: 'cod', idempotencyKey: key() });
    assert.equal(res.status, 401);
    assert.equal((await Product.findById(p.id)).stock, 5);
    assert.equal(await Order.countDocuments(), 0);
  });

  test('cash on delivery: stock goes down and the total uses database prices', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(10, 180);
    const res = await agent.post('/api/orders').send({
      items: [{ productId: p.id, qty: 2, price: 1 }], // a price sent by the browser is ignored
      address,
      paymentMethod: 'cod',
      idempotencyKey: key(),
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.status, 'confirmed');
    assert.equal(res.body.order.total, 360);
    assert.equal(res.body.order.address.phone, '9876543210');
    assert.equal((await Product.findById(p.id)).stock, 8);
  });

  test('a refused order (not enough stock) saves nothing and changes no stock', async () => {
    const agent = await loggedInAgent();
    const plenty = await makeProduct(10);
    const scarce = await makeProduct(1);
    const res = await order(agent, [
      { productId: plenty.id, qty: 3 },
      { productId: scarce.id, qty: 2 },
    ]);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'OUT_OF_STOCK');
    assert.equal((await Product.findById(plenty.id)).stock, 10, 'first item must be rolled back');
    assert.equal((await Product.findById(scarce.id)).stock, 1);
    assert.equal(await Order.countDocuments(), 0);
  });

  test('simultaneous orders never oversell (5 in stock, 12 buyers)', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(5);
    const results = await Promise.all(Array.from({ length: 12 }, () => order(agent, [{ productId: p.id, qty: 1 }])));
    const ok = results.filter((r) => r.status === 201).length;
    const refused = results.filter((r) => r.status === 409).length;
    assert.equal(ok, 5);
    assert.equal(refused, 7);
    assert.equal((await Product.findById(p.id)).stock, 0);
    assert.equal(await Order.countDocuments(), 5);
  });

  test('pressing Pay twice creates one order and takes stock once', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(10);
    const k = key();
    const [a, b] = await Promise.all([order(agent, [{ productId: p.id, qty: 2 }], 'cod', k), order(agent, [{ productId: p.id, qty: 2 }], 'cod', k)]);
    assert.equal(a.body.order.id, b.body.order.id);
    assert.equal((await Product.findById(p.id)).stock, 8);
    assert.equal(await Order.countDocuments(), 1);
  });

  test('bad input gets a clear message', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(10);
    const res = await agent.post('/api/orders').send({ items: [{ productId: p.id, qty: 1 }], address: { ...address, pincode: '3800' }, paymentMethod: 'cod', idempotencyKey: key() });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Enter a 6-digit pincode');
  });
});

describe('online payments (Cashfree, mock mode)', () => {
  test('reserve, then pay: stock is held, then the order is paid exactly once', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(4);
    const res = await order(agent, [{ productId: p.id, qty: 1 }], 'upi');
    assert.equal(res.status, 201);
    const o = res.body.order;
    assert.equal(o.status, 'awaiting_payment');
    assert.ok(o.payment.paymentSessionId);
    assert.equal((await Product.findById(p.id)).stock, 3);

    const paid = await agent.post(`/api/payments/mock/${o.id}/complete`).send({ outcome: 'success' });
    assert.equal(paid.body.order.status, 'paid');
    assert.equal(paid.body.order.payment.paymentSessionId, null);
    const again = await agent.post(`/api/payments/mock/${o.id}/complete`).send({ outcome: 'success' });
    assert.equal(again.body.order.status, 'paid');
    assert.equal((await Product.findById(p.id)).stock, 3);
  });

  test('a failed attempt keeps the hold so the customer can retry', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(4);
    const { body } = await order(agent, [{ productId: p.id, qty: 2 }], 'card');
    const failed = await agent.post(`/api/payments/mock/${body.order.id}/complete`).send({ outcome: 'failure' });
    assert.equal(failed.body.order.status, 'awaiting_payment');
    assert.equal(failed.body.order.payment.lastAttempt, 'failed');
    assert.equal((await Product.findById(p.id)).stock, 2);
  });

  test('an expired hold returns the stock', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(4);
    const { body } = await order(agent, [{ productId: p.id, qty: 3 }], 'upi');
    await Order.updateOne({ _id: body.order.id }, { $set: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await sweepExpiredHolds();
    const o = await Order.findById(body.order.id);
    assert.equal(o.status, 'failed');
    assert.equal(o.failureReason, 'hold_expired');
    assert.equal((await Product.findById(p.id)).stock, 4);
  });

  test('cancelling returns the stock; switching to COD keeps it', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(10);
    const a = (await order(agent, [{ productId: p.id, qty: 2 }], 'upi')).body.order;
    const b = (await order(agent, [{ productId: p.id, qty: 3 }], 'upi')).body.order;
    assert.equal((await Product.findById(p.id)).stock, 5);

    const cancelled = await agent.post(`/api/orders/${a.id}/cancel`).send({});
    assert.equal(cancelled.body.order.status, 'failed');
    const cod = await agent.post(`/api/orders/${b.id}/switch-to-cod`).send({});
    assert.equal(cod.body.order.status, 'confirmed');
    assert.equal(cod.body.order.paymentMethod, 'cod');
    assert.equal((await Product.findById(p.id)).stock, 7);
  });

  test('paid after the hold expired: re-reserves stock, or refunds if it sold out', async () => {
    const agent = await loggedInAgent();
    const p = await makeProduct(2);
    const first = (await order(agent, [{ productId: p.id, qty: 1 }], 'upi')).body.order;
    const second = (await order(agent, [{ productId: p.id, qty: 1 }], 'upi')).body.order;
    // Both holds expire while the gateway still lets the customer pay.
    await Order.updateMany({}, { $set: { status: 'failed', holdExpiresAt: null } });
    await Product.updateOne({ _id: p.id }, { $set: { stock: 1 } });

    const late1 = await agent.post(`/api/payments/mock/${first.id}/complete`).send({ outcome: 'success' });
    assert.equal(late1.body.order.status, 'paid');
    assert.equal((await Product.findById(p.id)).stock, 0);

    const late2 = await agent.post(`/api/payments/mock/${second.id}/complete`).send({ outcome: 'success' });
    assert.equal(late2.body.order.status, 'refunded');
    assert.equal((await Product.findById(p.id)).stock, 0);
    assert.equal(gateway._mockGet(second.orderNumber).refunds.length, 1);
  });

  test('another user cannot see or pay my order', async () => {
    const me = await loggedInAgent();
    const them = await loggedInAgent();
    const p = await makeProduct(3);
    const o = (await order(me, [{ productId: p.id, qty: 1 }], 'upi')).body.order;
    assert.equal((await them.get(`/api/orders/${o.id}`)).status, 404);
    assert.equal((await them.post(`/api/payments/mock/${o.id}/complete`).send({ outcome: 'success' })).status, 404);
  });
});

describe('Cashfree webhook', () => {
  const secret = 'webhook-test-secret';
  const sign = (ts, body) => crypto.createHmac('sha256', secret).update(ts + body).digest('base64');

  test('signature check accepts the real one and rejects tampering', () => {
    const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'FM-1' } } });
    const ts = String(Date.now());
    assert.equal(gateway.verifyWebhook(body, sign(ts, body), ts, secret), true);
    assert.equal(gateway.verifyWebhook(body.replace('FM-1', 'FM-2'), sign(ts, body), ts, secret), false);
    assert.equal(gateway.verifyWebhook(body, undefined, ts, secret), false);
  });

  test('an unsigned webhook is refused', async () => {
    const res = await request(app).post('/api/payments/cashfree/webhook').set('content-type', 'application/json').send('{"type":"PAYMENT_SUCCESS_WEBHOOK"}');
    assert.equal(res.status, 401);
  });
});
