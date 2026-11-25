import { Router } from 'express';
import { CATEGORIES, Product } from '../models/Product.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res) => {
  const filter = {};
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  if (category && category !== 'All') {
    if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Unknown category.', 'BAD_CATEGORY');
    filter.category = category;
  }
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  const products = await Product.find(filter).sort({ category: 1, name: 1 });
  res.json({ products });
});

router.get('/categories', async (_req, res) => {
  const counts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({ categories: CATEGORIES.map((name) => ({ name, count: byName[name] || 0 })) });
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.', 'NOT_FOUND');
  res.json({ product });
});

export default router;
