import { pathToFileURL } from 'node:url';
import { Product } from '../models/Product.js';
import { PRODUCTS } from './products.js';

/** Inserts the catalogue when the products collection is empty. Returns how many were added. */
export async function seedIfEmpty() {
  if ((await Product.estimatedDocumentCount()) > 0) return 0;
  await Product.insertMany(PRODUCTS);
  return PRODUCTS.length;
}

// `npm run seed` (adds products if empty) or `npm run seed:reset` (replaces them).
async function cli() {
  const { env } = await import('../config/env.js');
  const { connectDB, disconnectDB } = await import('../config/db.js');
  if (!env.mongoUri) {
    console.error('Set MONGO_URI first. Without it the dev server seeds its in-memory database by itself.');
    process.exit(1);
  }
  await connectDB(env.mongoUri);
  if (process.argv.includes('--reset')) {
    const { deletedCount } = await Product.deleteMany({});
    console.log(`Removed ${deletedCount} products`);
  }
  const added = await seedIfEmpty();
  console.log(added ? `Added ${added} products` : 'Products already exist. Use npm run seed:reset to replace them.');
  await disconnectDB();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
