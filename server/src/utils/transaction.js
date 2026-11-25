import mongoose from 'mongoose';

const TX_OPTIONS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

/**
 * Runs fn(session) inside one ACID transaction. MongoDB may retry fn on a
 * transient error (for example two orders racing for the same product), so
 * fn must compute everything from scratch each time it runs.
 */
export async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    }, TX_OPTIONS);
    return result;
  } finally {
    await session.endSession();
  }
}
