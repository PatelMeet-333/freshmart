import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedIfEmpty } from './seed/seed.js';
import { startHoldSweeper } from './services/payments.js';
import { Order } from './models/Order.js';
import { Product } from './models/Product.js';
import { User } from './models/User.js';

async function main() {
  const { usingMemory } = await connectDB(env.mongoUri);
  // Build indexes (unique email, idempotency key) before taking traffic.
  await Promise.all([User.init(), Product.init(), Order.init()]);
  const seeded = await seedIfEmpty();

  console.log(`[db] ${usingMemory ? 'In-memory MongoDB (data resets on restart)' : 'Connected to MongoDB'}`);
  if (seeded) console.log(`[db] Seeded ${seeded} products`);
  console.log(`[payments] Cashfree mode: ${env.cashfree.mode}`);

  startHoldSweeper();
  const server = createApp().listen(env.port, () => {
    console.log(`[api] FreshMart API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[api] Failed to start:', err);
  process.exit(1);
});
