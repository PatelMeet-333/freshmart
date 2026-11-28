import mongoose from 'mongoose';

export const ORDER_STATUS = [
  'awaiting_payment', // stock reserved, waiting for Cashfree
  'confirmed', // cash on delivery, stock reserved
  'paid', // Cashfree payment verified
  'failed', // payment failed or hold expired, stock returned
  'refund_pending', // paid after the hold expired and stock ran out
  'refunded',
];

export const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'cod'];

const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    unit: String,
    image: String,
    price: Number,
    qty: Number,
    lineTotal: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true },
    items: { type: [lineSchema], required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    address: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      pincode: String,
    },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: ORDER_STATUS, required: true, index: true },
    holdExpiresAt: { type: Date, default: null, index: true },
    failureReason: { type: String, default: null },
    payment: {
      gateway: { type: String, default: null }, // 'cashfree' | 'mock' | null for COD
      cfOrderId: String,
      paymentSessionId: String,
      cfPaymentId: String,
      lastAttempt: String, // 'failed' | 'dropped' when the last try didn't go through
      paidAt: Date,
      refundId: String,
    },
  },
  { timestamps: true }
);

// One order per checkout attempt, even if the "Pay" button is pressed twice.
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });

export const Order = mongoose.model('Order', orderSchema);

export function toClientOrder(order) {
  const o = order.toObject ? order.toObject() : order;
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    items: o.items.map((l) => ({
      productId: l.product.toString(),
      name: l.name,
      unit: l.unit,
      image: l.image,
      price: l.price,
      qty: l.qty,
      lineTotal: l.lineTotal,
    })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    address: o.address,
    paymentMethod: o.paymentMethod,
    status: o.status,
    holdExpiresAt: o.holdExpiresAt,
    serverNow: new Date(),
    payment: {
      gateway: o.payment?.gateway ?? null,
      lastAttempt: o.payment?.lastAttempt ?? null,

      paymentSessionId: o.status === 'awaiting_payment' ? o.payment?.paymentSessionId ?? null : null,
    },
    createdAt: o.createdAt,
  };
}
