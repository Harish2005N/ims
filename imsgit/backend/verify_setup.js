const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

const users = [
    { username: "Admin User", email: "admin@test.com", password: "password123", role: "admin" },
    { username: "Seller User", email: "seller@test.com", password: "password123", role: "seller" },
    { username: "Buyer User", email: "buyer@test.com", password: "password123", role: "buyer" }
];

async function verify() {
    console.log("🚀 Starting verification script...");

    for (const user of users) {
        let token;
        try {
            console.log(`\n--- Registering ${user.role}: ${user.email} ---`);
            const regRes = await axios.post(`${API_BASE}/auth/register`, user);
            console.log(`✅ Registered!`);
            token = regRes.data.token;
        } catch (err) {
            if (err.response && err.response.data && err.response.data.message === "User already exists") {
                console.log(`ℹ️ User ${user.email} already exists, logging in...`);
                const loginRes = await axios.post(`${API_BASE}/auth/login`, { email: user.email, password: user.password });
                console.log(`✅ Logged in!`);
                token = loginRes.data.token;
            } else {
                console.error(`❌ Error registry/login for ${user.role}:`, err.response ? err.response.data : err.message);
                continue;
            }
        }

        if (user.role === 'admin' && token) {
            try {
                console.log(`--- Seeding data with Admin token ---`);
                const seedRes = await axios.post(`${API_BASE}/products/seed/data`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`✅ Seeded ${seedRes.data.count} products!`);
            } catch (err) {
                console.error(`❌ Error seeding:`, err.response ? err.response.data : err.message);
            }
        }
    }

    console.log("\n🏁 Verification script finished.");
}

verify();
