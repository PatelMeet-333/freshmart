import mongoose from 'mongoose';

let memoryServer = null;
export async function connectDB(uri) {
  let target = uri;
  if (!target) {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
      // Keep the local database small so it runs on low-memory machines.
      instanceOpts: [{ args: ['--wiredTigerCacheSizeGB', '0.25'] }],
    });
    target = memoryServer.getUri();
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(target, { writeConcern: { w: 'majority' } });
  return { usingMemory: Boolean(memoryServer) };
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
