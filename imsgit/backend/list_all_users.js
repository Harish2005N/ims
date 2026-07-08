const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/inventoryDB')
  .then(async () => {
    const users = await User.find({}, 'username email role');
    console.log('--- USER LIST ---');
    users.forEach(u => {
      console.log(`Role: ${u.role} | Email: ${u.email} | Name: ${u.username}`);
    });
    console.log('-----------------');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
