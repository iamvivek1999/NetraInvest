const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// 1. Files replacement
const filesToUpdate = [
  'backend/src/services/txVerification.service.js',
  'backend/src/services/blockchain.service.js',
  'backend/src/controllers/investment.controller.js',
  'backend/src/controllers/campaign.controller.js',
  'frontend/src/utils/contract.js',
  'frontend/src/pages/dashboard/InvestorDashboard.jsx',
  'frontend/src/components/InvestModal.jsx'
];

for (const relPath of filesToUpdate) {
  const fullPath = path.join('d:\\Enigma', relPath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/amountMatic/g, 'amountINR');
    content = content.replace(/fundingGoalMatic/g, 'fundingGoalINR');
    content = content.replace(/maticToWei/g, 'inrToWei');
    content = content.replace(/weiToMatic/g, 'weiToINR');
    content = content.replace(/formatMatic/g, 'formatINR');
    content = content.replace(/\(matic\)/g, '(inr)');
    
    // contract.js has " * @param {string|number} matic"
    content = content.replace(/\* @param \{string\|number\} matic/g, '* @param {string|number} inr');
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated file: ${relPath}`);
  } else {
    console.warn(`File not found: ${fullPath}`);
  }
}

// 2. DB Update
async function updateDB() {
  await mongoose.connect('mongodb://localhost:27017/Enigma', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).catch(e => console.log('Try test db instead...'));
  
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect('mongodb://localhost:27017/test');
  }

  const campaigns = mongoose.connection.collection('campaigns');
  const res = await campaigns.updateMany({ currency: 'MATIC' }, { $set: { currency: 'INR' } });
  console.log(`Updated ${res.modifiedCount} campaigns in DB.`);

  const investments = mongoose.connection.collection('investments');
  const res2 = await investments.updateMany({ currency: 'MATIC' }, { $set: { currency: 'INR' } });
  console.log(`Updated ${res2.modifiedCount} investments in DB.`);

  process.exit(0);
}

updateDB();
