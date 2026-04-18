/**
 * src/config/db.js
 *
 * Mongoose connection utility.
 * Called once from server.js before starting the HTTP server.
 * Exits the process if connection fails — no point running without a DB.
 */

const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      // These are the recommended settings for Mongoose 8+
      serverSelectionTimeoutMS: 5000, // fail fast if DB is unreachable
    });

    console.log(`[DB] MongoDB connected: ${conn.connection.host}`.cyan.bold);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`.red.bold);
    process.exit(1); // hard exit — app cannot run without database
  }
};

// Mongoose connection event listeners for visibility during development
mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected'.yellow);
});

mongoose.connection.on('reconnected', () => {
  console.log('[DB] MongoDB reconnected'.cyan);
});

module.exports = connectDB;
