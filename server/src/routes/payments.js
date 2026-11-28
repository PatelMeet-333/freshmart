import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { Order, toClientOrder } from '../models/Order.js';
import { gateway } from '../services/cashfree.js';
import { confirmPayment, recordFailedAttempt } from '../services/payments.js';
import { HttpError } from '../utils/httpError.js';

export async function cashfreeWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const signature = req.get('x-webhook-signature');
  const timestamp = req.get('x-webhook-timestamp');
  if (!gateway.verifyWebhook(raw, signature, timestamp)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ message: 'Bad payload' });
  }

  const orderNumber = event?.data?.order?.order_id;
  const payment = event?.data?.payment || {};
  const order = orderNumber ? await Order.findOne({ orderNumber }) : null;
  // Always 200 for a correctly signed event so Cashfree stops retrying,
  // even for orders we don't know (for example from another environment).
  if (!order) return res.json({ ok: true, ignored: true });

  switch (event.type) {
    case 'PAYMENT_SUCCESS_WEBHOOK':
      await confirmPayment(order._id, { cfPaymentId: String(payment.cf_payment_id), amount: payment.payment_amount });
      break;
    case 'PAYMENT_FAILED_WEBHOOK':
      await recordFailedAttempt(order._id, 'failed');
      break;
    case 'PAYMENT_USER_DROPPED_WEBHOOK':
      await recordFailedAttempt(order._id, 'dropped');
      break;
    default:
      break;
  }
  return res.json({ ok: true });
}

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ mode: gateway.mode, deliveryFee: env.deliveryFee, holdMinutes: env.holdMinutes });
});

if (gateway.mode === 'mock') {
  const mockSchema = z.object({ outcome: z.enum(['success', 'failure', 'dropped']) });
  router.post('/mock/:orderId/complete', requireAuth, async (req, res) => {
    const { outcome } = mockSchema.parse(req.body);
    if (!mongoose.isValidObjectId(req.params.orderId)) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user.id });
    if (!order) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
    const mock = gateway.mockComplete(order.orderNumber, outcome);
    if (!mock) throw new HttpError(409, 'This payment can no longer be completed.', 'NOT_PAYABLE');
    if (outcome === 'success') {
      await confirmPayment(order._id, { cfPaymentId: mock.cfPaymentId, amount: mock.amount });
    } else {
      await recordFailedAttempt(order._id, outcome === 'dropped' ? 'dropped' : 'failed');
    }
    res.json({ order: toClientOrder(await Order.findById(order._id)) });
  });
}

export default router;
