import mongoose from 'mongoose';

const TX_OPTIONS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
};

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
