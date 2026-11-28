import crypto from 'node:crypto';
import { env } from '../config/env.js';
const BASE_URLS = {
  sandbox: 'https://sandbox.cashfree.com/pg',
  production: 'https://api.cashfree.com/pg',
};

const METHOD_FILTER = { upi: 'upi', card: 'cc,dc', netbanking: 'nb' };

const { mode } = env.cashfree;
const mockOrders = new Map(); // orderNumber -> { status, amount, cfPaymentId, refunds }

class GatewayError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call(method, path, body, { idempotencyKey } = {}) {
  const headers = {
    'x-client-id': env.cashfree.appId,
    'x-client-secret': env.cashfree.secretKey,
    'x-api-version': env.cashfree.apiVersion,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
  const res = await fetch(BASE_URLS[mode] + path, {
    method,
    headrs,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GatewayError(`Cashfree ${method} ${path} failed (${res.status}): ${data.message || 'no message'}`, res.status, data.code);
  }
  return data;
}

function isHttps(url) {
  return url.startsWith('https://');
}

export const gateway = {
  mode,
  name: mode === 'mock' ? 'mock' : 'cashfree',
  async createOrder(order, user) {
    if (mode === 'mock') {
      mockOrders.set(order.orderNumber, { status: 'ACTIVE', amount: order.total, cfPaymentId: null, refunds: [] });
      return { cfOrderId: `mock_${order.orderNumber}`, paymentSessionId: `mock_session_${order.orderNumber}` };
    }

    const clientUrl = env.clientUrls[0];
    // Cashfree needs at least ~15 minutes; keep it just past our own hold.
    const expiryMinutes = Math.max(env.holdMinutes + 1, 16);
    const orderMeta = {
      return_url: `${clientUrl}/order/${order._id}?return=1`,
      payment_methods: METHOD_FILTER[order.paymentMethod],
    };
    // Cashfree only calls https webhooks; locally we rely on status checks instead.
    if (isHttps(env.apiUrl)) orderMeta.notify_url = `${env.apiUrl}/api/payments/cashfree/webhook`;

    let data;
    try {
      data = await call(
        'POST',
        '/orders',
        {
          order_id: order.orderNumber,
          order_amount: Number(order.total.toFixed(2)),
          order_currency: 'INR',
          customer_details: {
            customer_id: user._id.toString(),
            customer_name: order.address.fullName,
            customer_email: user.email,
            customer_phone: order.address.phone,
          },
          order_meta: orderMeta,
          order_expiry_time: new Date(Date.now() + expiryMinutes * 60_000).toISOString(),
          order_note: `FreshMart order ${order.orderNumber}`,
        },
        { idempotencyKey: order.orderNumber }
      );
    } catch (err) {
      // Our order number is Cashfree's order id, so a retry can only find the same order.
      if (err.status === 409) data = await call('GET', `/orders/${encodeURIComponent(order.orderNumber)}`);
      else throw err;
    }
    return { cfOrderId: String(data.cf_order_id), paymentSessionId: data.payment_session_id };
  },

  /** 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED' | 'TERMINATION_REQUESTED' */
  async getOrderStatus(orderNumber) {
    if (mode === 'mock') return mockOrders.get(orderNumber)?.status ?? 'EXPIRED';
    const data = await call('GET', `/orders/${encodeURIComponent(orderNumber)}`);
    return data.order_status;
  },

  async getSuccessfulPayment(orderNumber) {
    if (mode === 'mock') {
      const m = mockOrders.get(orderNumber);
      return m?.status === 'PAID' ? { cfPaymentId: m.cfPaymentId, amount: m.amount } : null;
    }
    const payments = await call('GET', `/orders/${encodeURIComponent(orderNumber)}/payments`);
    const ok = (Array.isArray(payments) ? payments : []).find((p) => p.payment_status === 'SUCCESS');
    return ok ? { cfPaymentId: String(ok.cf_payment_id), amount: Number(ok.payment_amount) } : null;
  },

  /** Stops further payment attempts. Best effort: a PAID order can't be terminated. */
  async terminateOrder(orderNumber) {
    if (mode === 'mock') {
      const m = mockOrders.get(orderNumber);
      if (m && m.status === 'ACTIVE') m.status = 'TERMINATED';
      return;
    }
    try {
      await call('PATCH', `/orders/${encodeURIComponent(orderNumber)}`, { order_status: 'TERMINATED' });
    } catch (err) {
      console.warn(`[cashfree] could not terminate ${orderNumber}: ${err.message}`);
    }
  },

  async refund(orderNumber, amount, refundId) {
    if (mode === 'mock') {
      mockOrders.get(orderNumber)?.refunds.push({ refundId, amount });
      return { refundId };
    }
    await call(
      'POST',
      `/orders/${encodeURIComponent(orderNumber)}/refunds`,
      { refund_amount: Number(amount.toFixed(2)), refund_id: refundId, refund_note: 'Items sold out before payment completed' },
      { idempotencyKey: refundId }
    );
    return { refundId };
  },

  verifyWebhook(rawBody, signature, timestamp, secret = env.cashfree.secretKey) {
    if (!signature || !timestamp || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(String(timestamp) + rawBody).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  mockComplete(orderNumber, outcome) {
    const m = mockOrders.get(orderNumber);
    if (!m) return null;
    if (outcome === 'success') {
      if (m.status === 'ACTIVE' || m.status === 'EXPIRED') {
        m.status = 'PAID';
        m.cfPaymentId = `mockpay_${crypto.randomBytes(4).toString('hex')}`;
      }
    }
    return m;
  },

  _mockSet(orderNumber, patch) {
    Object.assign(mockOrders.get(orderNumber), patch);
  },
  _mockGet(orderNumber) {
    return mockOrders.get(orderNumber);
  },
};
