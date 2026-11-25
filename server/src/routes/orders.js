import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { Order, PAYMENT_METHODS, toClientOrder } from '../models/Order.js';
import { User } from '../models/User.js';
import { gateway } from '../services/cashfree.js';
import { normaliseItems, reserveItems } from '../services/inventory.js';
import { cancelPayment, reconcile, releaseHold, switchToCod } from '../services/payments.js';
import { HttpError } from '../utils/httpError.js';
import { runInTransaction } from '../utils/transaction.js';

const router = Router();
router.use(requireAuth);

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many orders in a short time. Wait a few minutes.', code: 'RATE_LIMITED' },
});

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'That product id is not valid');
const digitsOnly = (v) => String(v).replace(/[\s-]/g, '');

const createOrderSchema = z.object({
  items: z
    .array(z.object({ productId: objectId, qty: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'You can order up to 20 of one item') }))
    .min(1, 'Your cart is empty')
    .max(50, 'Too many different items in one order'),
  address: z.object({
    fullName: z.string().trim().min(2, 'Enter the full name').max(60),
    phone: z.preprocess(digitsOnly, z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number')),
    line1: z.string().trim().min(3, 'Enter the house, flat and street').max(120),
    line2: z.string().trim().max(120).optional().default(''),
    city: z.string().trim().min(2, 'Enter the city').max(60),
    pincode: z.preprocess(digitsOnly, z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode')),
  }),
  paymentMethod: z.enum(PAYMENT_METHODS, 'Choose how to pay'),
  idempotencyKey: z.string().min(8).max(100),
});

function newOrderNumber() {
  return `FM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

async function findOwnOrder(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
  const order = await Order.findOne({ _id: req.params.id, user: req.user.id });
  if (!order) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
  return order;
}

router.post('/', orderLimiter, async (req, res) => {
  const body = createOrderSchema.parse(req.body);
  const userId = req.user.id;

  const existing = await Order.findOne({ user: userId, idempotencyKey: body.idempotencyKey });
  if (existing) return res.status(200).json({ order: toClientOrder(existing) });

  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, 'Log in to continue.', 'UNAUTHENTICATED');

  const items = normaliseItems(body.items);
  const isCod = body.paymentMethod === 'cod';

  // Step 1 (one ACID transaction): take the stock and save the order together.
  let order;
  try {
    order = await runInTransaction(async (session) => {
      const lines = await reserveItems(items, session);
      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const [doc] = await Order.create(
        [
          {
            user: userId,
            orderNumber: newOrderNumber(),
            idempotencyKey: body.idempotencyKey,
            items: lines,
            subtotal,
            deliveryFee: env.deliveryFee,
            total: subtotal + env.deliveryFee,
            address: body.address,
            paymentMethod: body.paymentMethod,
            status: isCod ? 'confirmed' : 'awaiting_payment',
            holdExpiresAt: isCod ? null : new Date(Date.now() + env.holdMinutes * 60_000),
            payment: { gateway: isCod ? null : gateway.name },
          },
        ],
        { session }
      );
      return doc;
    });
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.idempotencyKey) {
      const dup = await Order.findOne({ user: userId, idempotencyKey: body.idempotencyKey });
      return res.status(200).json({ order: toClientOrder(dup) });
    }
    throw err;
  }

  // Step 2: open a Cashfree order. If that fails, give the stock straight back.
  if (!isCod) {
    try {
      const { cfOrderId, paymentSessionId } = await gateway.createOrder(order, user);
      await Order.updateOne(
        { _id: order._id },
        { $set: { 'payment.cfOrderId': cfOrderId, 'payment.paymentSessionId': paymentSessionId } }
      );
    } catch (err) {
      console.error(`[orders] Cashfree order creation failed for ${order.orderNumber}: ${err.message}`);
      await releaseHold(order._id, 'gateway_error');
      throw new HttpError(502, 'We couldn’t start the payment. Try again, or choose cash on delivery.', 'GATEWAY_ERROR');
    }
  }

  const fresh = await Order.findById(order._id);
  res.status(201).json({ order: toClientOrder(fresh) });
});

router.get('/:id', async (req, res) => {
  const order = await findOwnOrder(req);
  res.json({ order: toClientOrder(order) });
});

// Called when the customer returns from Cashfree checkout.
router.post('/:id/verify-payment', async (req, res) => {
  const order = await findOwnOrder(req);
  const fresh = await reconcile(order._id);
  res.json({ order: toClientOrder(fresh) });
});

router.post('/:id/cancel', async (req, res) => {
  const order = await findOwnOrder(req);
  const fresh = await cancelPayment(order._id);
  res.json({ order: toClientOrder(fresh) });
});

router.post('/:id/switch-to-cod', async (req, res) => {
  const order = await findOwnOrder(req);
  const fresh = await switchToCod(order._id);
  res.json({ order: toClientOrder(fresh) });
});

export default router;
