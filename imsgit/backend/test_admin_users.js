const axios = require('axios');

async function testAdminUsers() {
    const API_BASE = 'http://localhost:5000/api';
    
    try {
        // 1. Login as Admin
        console.log("Logging in as admin...");
        const loginRes = await axios.post(`${API_BASE}/auth/login`, {
            email: "admin@gmail.com",
            password: "password123"
        });
        const token = loginRes.data.token;
        console.log("✅ Logged in as admin");

        // 2. Fetch Users
        console.log("Fetching users with stats...");
        const usersRes = await axios.get(`${API_BASE}/auth/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("✅ Users fetched successfully!");
        console.log(`Count: ${usersRes.data.count}`);
        
        usersRes.data.data.forEach(u => {
            console.log(`- [${u.role.toUpperCase()}] ${u.username} (${u.email})`);
            if (u.role === 'seller') {
                console.log(`  Stats: ${u.totalProducts} products, ${u.totalRevenue} revenue`);
            } else if (u.role === 'buyer') {
                console.log(`  Stats: ${u.totalUnitsBought} units bought, ${u.totalSpent} spent`);
            }
        });

    } catch (err) {
        console.error("❌ Error:", err.response ? err.response.data : err.message);
    }
}

testAdminUsers();
