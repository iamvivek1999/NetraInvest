const env = require('./src/config/env');
const mongoose = require('mongoose');
const User = require('./src/models/User'); // Adjust path to user model

async function seed() {
  await mongoose.connect(env.MONGO_URI);

  // Create Startup User
  try {
    const startup = new User({
      fullName: 'Startup Test',
      email: 'startup123@test.com',
      passwordHash: 'Pass1234',
      walletAddress: '0x1111111111111111111111111111111111111111',
      role: 'startup',
      isEmailVerified: true
    });
    await startup.save();
    console.log('Startup created');
  } catch (e) {
    console.log('startup err (might exist):', e.message);
  }

  // Create Admin User
  try {
    const admin = new User({
      fullName: 'Admin Test',
      email: 'admin@enigmacapital.com',
      passwordHash: 'Pass1234',
      walletAddress: '0x2222222222222222222222222222222222222222',
      role: 'admin',
      isEmailVerified: true
    });
    await admin.save();
    console.log('Admin created');
  } catch (e) {
    console.log('admin err (might exist):', e.message);
  }

  console.log('Seeding complete. Exiting.');
  process.exit();
}
seed();
