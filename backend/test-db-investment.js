import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Investment from './src/models/Investment.js';

async function testInvestment() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  try {
    const inv = await Investment.create({
      campaignId: new mongoose.Types.ObjectId(),
      startupProfileId: new mongoose.Types.ObjectId(),
      investorUserId: new mongoose.Types.ObjectId(),
      amount: 500,
      currency: 'INR',
      status: 'confirmed',
      confirmedAt: new Date(),
      verificationNote: 'Razorpay payment verified',
      paymentOrderId: 'order_12345',
      paymentId: 'pay_12345',
      paymentProvider: 'razorpay'
    });
    console.log('Investment saved successfully!', inv._id);
  } catch (err) {
    console.error('Validation Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

testInvestment();
