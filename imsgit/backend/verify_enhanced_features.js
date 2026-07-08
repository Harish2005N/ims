const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
let token = '';

async function runTests() {
  try {
    console.log('--- Order Fulfillment & Images Verification ---');

    // 1. Login as Admin/Seller
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@test.com',
      password: 'password123'
    });
    token = loginRes.data.token;
    console.log('✅ Logged in as Admin');

    // 2. Create Product with Image
    const pRes = await axios.post(`${API_BASE}/products`, {
      productName: 'Feature Test Product',
      category: 'Electronics',
      supplier: 'Test Supplier',
      purchasePrice: 100,
      sellingPrice: 150,
      quantity: 10,
      imageUrl: 'https://placehold.co/400x400/blue/white?text=Test+Product'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const productId = pRes.data.data._id;
    console.log('✅ Created product with Image:', productId);

    // 3. Login or Register as Buyer
    let bToken = '';
    try {
        const bLogin = await axios.post(`${API_BASE}/auth/login`, {
            email: 'buyer@test.com',
            password: 'password123'
        });
        bToken = bLogin.data.token;
        console.log('✅ Logged in as Buyer');
    } catch (e) {
        console.log('ℹ️ Buyer not found, registering...');
        const bReg = await axios.post(`${API_BASE}/auth/register`, {
            username: 'TestBuyer',
            email: 'buyer@test.com',
            password: 'password123',
            role: 'buyer'
        });
        bToken = bReg.data.token;
        console.log('✅ Registered and logged in as Buyer');
    }

    // 4. Buy Product with Payment Method
    const buyRes = await axios.post(`${API_BASE}/products/${productId}/buy`, {
        quantity: 2,
        paymentMethod: 'UPI'
    }, {
        headers: { Authorization: `Bearer ${bToken}` }
    });
    console.log('✅ Purchase successful with UPI');

    // 5. Check Orders (Seller view) - get recent
    const ordersRes = await axios.get(`${API_BASE}/products/transactions/seller`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const lastOrder = ordersRes.data.data[0];
    console.log('✅ Order retrieved. Initial status:', lastOrder.status); // Should be 'pending'

    // 6. Update status to PAID
    const statusRes = await axios.patch(`${API_BASE}/products/transactions/${lastOrder._id}/status`, {
        status: 'paid'
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Order status updated to:', statusRes.data.data.status);

    console.log('\n--- ALL VERIFICATION STEPS PASSED ---');
  } catch (err) {
    console.error('❌ Verification failed:', err.response ? err.response.data : err.message);
  }
}

runTests();
