const mongoose = require('mongoose');

async function updateDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/test');
    
    const campaigns = mongoose.connection.collection('campaigns');
    const res = await campaigns.updateMany({ currency: 'MATIC' }, { $set: { currency: 'INR' } });
    console.log('Campaigns updated:', res.modifiedCount);

    const investments = mongoose.connection.collection('investments');
    const res2 = await investments.updateMany({ currency: 'MATIC' }, { $set: { currency: 'INR' } });
    console.log('Investments updated:', res2.modifiedCount);
    
    process.exit(0);
  } catch (err) {
    console.error('Error updating DB:', err);
    process.exit(1);
  }
}
updateDB();
