const mongoose = require('mongoose');
const User = require('./backend/models/User');

const MONGO_URI = "mongodb://localhost:27017/inventoryDB";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const users = await User.find({}, 'username email role');
    console.log("Registered Users:");
    console.table(users.map(u => ({ username: u.username, email: u.email, role: u.role })));
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection failed:", err.message);
    process.exit(1);
  });
