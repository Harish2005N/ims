const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/inventoryDB';

async function resetAdmin() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // 1. Delete all existing users
        const deleteRes = await User.deleteMany({});
        console.log(`🗑️ Deleted ${deleteRes.deletedCount} users`);

        // 2. Create default Admin
        const adminUser = {
            username: "Default Admin",
            email: "admin@gmail.com",
            password: "password123", // User.js pre-save hook will hash this
            role: "admin"
        };

        const newAdmin = await User.create(adminUser);
        console.log(`✅ Created default Admin: ${newAdmin.email}`);

        await mongoose.connection.close();
        console.log("👋 Disconnected");
    } catch (err) {
        console.error("❌ Error resetting users:", err.message);
        process.exit(1);
    }
}

resetAdmin();
