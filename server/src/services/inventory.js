import { Product } from '../models/Product.js';
import { HttpError } from '../utils/httpError.js';

export function normaliseItems(items) {
  const byId = new Map();
  for (const { productId, qty } of items) {
    byId.set(productId, (byId.get(productId) || 0) + qty);
  }
  return [...byId.entries()]
    .map(([productId, qty]) => ({ productId, qty }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

export async function reserveItems(items, session) {
  const lines = [];
  for (const { productId, qty } of items) {
    const product = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { session, returnDocument: 'after' }
    );
    if (!product) {
      const current = await Product.findById(productId).session(session).lean();
      if (!current) {
        throw new HttpError(400, 'One of the items in your cart is no longer sold. Remove it and try again.', 'PRODUCT_NOT_FOUND', { productId });
      }
      const message =
        current.stock === 0
          ? `${current.name} just sold out. Remove it from your cart and try again.`
          : `Only ${current.stock} × ${current.name} left. Lower the quantity and try again.`;
      throw new HttpError(409, message, 'OUT_OF_STOCK', { productId, available: current.stock });
    }
    lines.push({
      product: product._id,
      name: product.name,
      unit: product.unit,
      image: product.image,
      price: product.price,
      qty,
      lineTotal: product.price * qty,
    });
  }
  return lines;
}

export async function restockItems(lines, session) {
  for (const line of lines) {
    await Product.updateOne({ _id: line.product }, { $inc: { stock: line.qty } }, { session });
  }
}
