import { Order } from '../models/Order.js';
import { HttpError } from '../utils/httpError.js';
import { runInTransaction } from '../utils/transaction.js';
import { gateway } from './cashfree.js';
import { reserveItems, restockItems } from './inventory.js';

function sameAmount(a, b) {
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}
export async function releaseHold(orderId, reason) {
  return runInTransaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: 'awaiting_payment' },
      { $set: { status: 'failed', failureReason: reason, holdExpiresAt: null } },
      { session, returnDocument: 'after' }
    );
    if (!order) return false;
    await restockItems(order.items, session);
    return true;
  });
}

export async function confirmPayment(orderId, { cfPaymentId, amount }) {
  const current = await Order.findById(orderId);
  if (!current) return 'unknown_order';
  if (amount !== undefined && !sameAmount(amount, current.total)) {
    console.error(`[payments] amount mismatch on ${current.orderNumber}: paid ${amount}, expected ${current.total}`);
    return 'amount_mismatch';
  }
  const paidFields = {
    status: 'paid',
    holdExpiresAt: null,
    failureReason: null,
    'payment.cfPaymentId': cfPaymentId,
    'payment.paidAt': new Date(),
    'payment.lastAttempt': null,
  };

  const updated = await runInTransaction((session) =>
    Order.findOneAndUpdate(
      { _id: orderId, status: { $in: ['awaiting_payment', 'confirmed'] } },
      { $set: paidFields },
      { session, returnDocument: 'after' }
    )
  );
  if (updated) return 'paid';

  const order = await Order.findById(orderId);
  if (order.status !== 'failed') return 'no_change'; // already paid, refunded, …


  try {
    const reReserved = await runInTransaction(async (session) => {
      const claimed = await Order.findOneAndUpdate(
        { _id: orderId, status: 'failed' },
        { $set: paidFields },
        { session, returnDocument: 'after' }
      );
      if (!claimed) return false;
      await reserveItems(
        claimed.items.map((l) => ({ productId: l.product.toString(), qty: l.qty })),
        session
      );
      return true;
    });
    return reReserved ? 'paid_late' : 'no_change';
  } catch (err) {
    if (err.code !== 'OUT_OF_STOCK' && err.code !== 'PRODUCT_NOT_FOUND') throw err;
  }

  const refundId = `rf_${order.orderNumber}`;
  const marked = await runInTransaction((session) =>
    Order.findOneAndUpdate(
      { _id: orderId, status: 'failed' },
      { $set: { status: 'refund_pending', 'payment.cfPaymentId': cfPaymentId, 'payment.refundId': refundId } },
      { session, returnDocument: 'after' }
    )
  );
  if (!marked) return 'no_change';
  await gateway.refund(order.orderNumber, order.total, refundId);
  await Order.updateOne({ _id: orderId, status: 'refund_pending' }, { $set: { status: 'refunded' } });
  return 'refunded';
}

export async function recordFailedAttempt(orderId, kind) {
  await Order.updateOne({ _id: orderId, status: 'awaiting_payment' }, { $set: { 'payment.lastAttempt': kind } });
}

export async function reconcile(orderId) {
  const order = await Order.findById(orderId);
  if (!order || !order.payment?.gateway) return order;
  if (!['awaiting_payment', 'confirmed', 'failed'].includes(order.status)) return order;

  const status = await gateway.getOrderStatus(order.orderNumber);
  if (status === 'PAID') {
    const payment = await gateway.getSuccessfulPayment(order.orderNumber);
    if (payment) await confirmPayment(order._id, payment);
  } else if (order.status === 'awaiting_payment') {
    const expired = order.holdExpiresAt && order.holdExpiresAt.getTime() <= Date.now();
    if (status === 'EXPIRED' || status === 'TERMINATED') {
      await releaseHold(order._id, 'payment_expired');
    } else if (expired) {
      await gateway.terminateOrder(order.orderNumber);
      // A payment may have landed between the status check and the terminate.
      if (!(await confirmIfPaid(order))) await releaseHold(order._id, 'hold_expired');
    }
  }
  return Order.findById(orderId);
}

export async function cancelPayment(orderId) {
  const order = await reconcile(orderId);
  if (order?.status !== 'awaiting_payment') return order;
  await gateway.terminateOrder(order.orderNumber);
  if (!(await confirmIfPaid(order))) await releaseHold(orderId, 'cancelled_by_customer');
  return Order.findById(orderId);
}

async function confirmIfPaid(order) {
  if ((await gateway.getOrderStatus(order.orderNumber)) !== 'PAID') return false;
  const payment = await gateway.getSuccessfulPayment(order.orderNumber);
  if (payment) await confirmPayment(order._id, payment);
  return true;
}

export async function switchToCod(orderId) {
  const order = await reconcile(orderId);
  if (order.status === 'paid') return order; // paid in the meantime, nothing to switch
  if (order.status !== 'awaiting_payment') {
    throw new HttpError(409, 'The hold on your items has ended. Place the order again from your cart.', 'HOLD_ENDED');
  }
  await gateway.terminateOrder(order.orderNumber);
  if (await confirmIfPaid(order)) return Order.findById(orderId);
  await runInTransaction((session) =>
    Order.findOneAndUpdate(
      { _id: orderId, status: 'awaiting_payment' },
      { $set: { status: 'confirmed', paymentMethod: 'cod', holdExpiresAt: null, 'payment.lastAttempt': null } },
      { session }
    )
  );
  return Order.findById(orderId);
}

/** Releases holds that ran out (checking Cashfree first, in case a webhook is late). */
export async function sweepExpiredHolds(limit = 50) {
  const expired = await Order.find({ status: 'awaiting_payment', holdExpiresAt: { $lte: new Date() } })
    .select('_id')
    .limit(limit)
    .lean();
  for (const { _id } of expired) {
    try {
      await reconcile(_id);
    } catch (err) {
      console.error(`[payments] sweep failed for ${_id}: ${err.message}`);
    }
  }
  return expired.length;
}

export function startHoldSweeper(intervalMs = 60_000) {
  const timer = setInterval(() => {
    sweepExpiredHolds().catch((err) => console.error('[payments] sweeper error', err));
  }, intervalMs);
  timer.unref();
  return timer;
}
