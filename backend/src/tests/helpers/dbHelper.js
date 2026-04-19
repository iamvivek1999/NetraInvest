/**
 * src/tests/helpers/dbHelper.js
 *
 * Per-suite MongoDB helper using MongoMemoryServer.
 *
 * Usage in a test file:
 *
 *   const { connectDB, disconnectDB, clearDB } = require('../helpers/dbHelper');
 *
 *   beforeAll(async () => { await connectDB(); });
 *   afterAll(async ()  => { await disconnectDB(); });
 *   afterEach(async () => { await clearDB(); });   // optional — clean slate per test
 *
 * Note: In --runInBand mode all suites share the same Node.js process and the
 * same Mongoose singleton. Each suite creates its own MongoMemoryServer instance.
 * Because afterAll(disconnectDB) runs BEFORE afterEach(clearDB) for the last
 * test in a suite, clearDB guards against the dead-connection scenario.
 */

'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

/**
 * Start an in-memory MongoDB instance and connect Mongoose.
 * Also patches process.env.MONGO_URI so any code that reads it gets a valid URI.
 */
const connectDB = async () => {
  // If already connected (e.g. previous suite didn't disconnect cleanly), disconnect first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
};

/**
 * Drop all collections between tests — clean slate per test without full disconnect.
 *
 * Guards against MongoExpiredSessionError: if called after disconnectDB
 * (possible in --runInBand mode due to afterAll/afterEach ordering), this is a no-op.
 */
const clearDB = async () => {
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState !== 1) return;

  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({}))
  );
};

/**
 * Disconnect Mongoose and stop the in-memory server.
 */
const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

module.exports = { connectDB, clearDB, disconnectDB };
