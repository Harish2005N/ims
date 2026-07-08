const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function verifyFeatures() {
    console.log("🚀 Starting feature verification...");

    try {
        // 1. Login as Buyer
        const buyerLogin = await axios.post(`${API_BASE}/auth/login`, { email: "buyer@test.com", password: "password123" });
        const buyerToken = buyerLogin.data.token;
        console.log("✅ Logged in as Buyer");

        // 2. Get Products
        const productsRes = await axios.get(`${API_BASE}/products`, {
            headers: { Authorization: `Bearer ${buyerToken}` }
        });
        const products = productsRes.data.data;
        console.log(`✅ Fetched ${products.length} products`);

        if (products.length > 0) {
            const product = products[0];
            const initialQty = product.quantity;
            console.log(`📦 Testing 'Buy' for product: ${product.productName} (Qty: ${initialQty})`);

            // 3. Buy Product
            const buyRes = await axios.post(`${API_BASE}/products/${product._id}/buy`, {}, {
                headers: { Authorization: `Bearer ${buyerToken}` }
            });
            console.log(`✅ Purchase successful! New Qty: ${buyRes.data.remainingQuantity}`);

            if (buyRes.data.remainingQuantity !== initialQty - 1) {
                console.error("❌ Stock decrement failed!");
            }
        }

        // 4. Test Seller ownership
        console.log("\n--- Testing Seller ownership ---");
        const sellerLogin = await axios.post(`${API_BASE}/auth/login`, { email: "seller@test.com", password: "password123" });
        const sellerToken = sellerLogin.data.token;
        console.log("✅ Logged in as Seller");

        // Try to delete a product seeded by admin (Seller shouldn't be able to)
        if (products.length > 0) {
            const adminProduct = products.find(p => p.productName === "MacBook Pro 14\"");
            if (adminProduct) {
                console.log(`🗑️ Testing deletion of Admin product by Seller: ${adminProduct.productName}`);
                try {
                    await axios.delete(`${API_BASE}/products/${adminProduct._id}`, {
                        headers: { Authorization: `Bearer ${sellerToken}` }
                    });
                    console.error("❌ Seller was able to delete Admin's product!");
                } catch (err) {
                    console.log(`✅ Access denied as expected: ${err.response.data.message}`);
                }
            }
        }

    } catch (err) {
        console.error("❌ Feature verification failed:", err.response ? err.response.data : err.message);
    }

    console.log("\n🏁 Feature verification finished.");
}

verifyFeatures();
