const axios = require('axios');
const API_BASE = 'http://localhost:5000/api';

async function test() {
  try {
    const timestamp = Date.now();
    const sellerEmail = `seller_${timestamp}@test.com`;
    const buyerEmail = `buyer_${timestamp}@test.com`;

    // 1. Register Seller
    console.log('Registering Test Seller...');
    const sellerReg = await axios.post(`${API_BASE}/auth/register`, {
      username: `seller_${timestamp}`,
      email: sellerEmail,
      password: 'password123',
      role: 'seller'
    });
    const sellerToken = sellerReg.data.token;
    console.log('Seller Registered.');

    // 2. Register Buyer
    console.log('Registering Test Buyer...');
    const buyerReg = await axios.post(`${API_BASE}/auth/register`, {
      username: `buyer_${timestamp}`,
      email: buyerEmail,
      password: 'password123',
      role: 'buyer'
    });
    const buyerToken = buyerReg.data.token;
    console.log('Buyer Registered.');

    // 3. Seller Creates Product with Image
    console.log('Seller creating product with image...');
    const prodRes = await axios.post(`${API_BASE}/products`, {
      productName: `Gadget ${timestamp}`,
      category: 'Electronics',
      supplier: 'Test Supplier',
      purchasePrice: 100,
      sellingPrice: 200,
      quantity: 50,
      imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=100&q=80'
    }, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const productId = prodRes.data.data._id;
    console.log('Product created with ID:', productId);

    // 4. Buyer purchases product with Payment Method
    console.log('Buyer purchasing product...');
    const buyRes = await axios.post(`${API_BASE}/products/${productId}/buy`, {
      quantity: 3,
      paymentMethod: 'Card'
    }, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    console.log('Purchase successful.');

    // 5. Get Buyer History and check Status/Payment
    const historyRes = await axios.get(`${API_BASE}/products/transactions/my`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    const tx = historyRes.data.data[0];
    console.log('Initial Status:', tx.status);
    console.log('Payment Method:', tx.paymentMethod);

    // 6. Seller updates status to 'paid'
    console.log('Seller updating status to "paid"...');
    await axios.patch(`${API_BASE}/products/transactions/${tx._id}/status`, {
      status: 'paid'
    }, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });

    // 7. Verify final status
    const finalHistoryRes = await axios.get(`${API_BASE}/products/transactions/my`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    console.log('Final Status (Buyer View):', finalHistoryRes.data.data[0].status);

    if (finalHistoryRes.data.data[0].status === 'paid') {
      console.log('✅ ALL TESTS PASSED!');
    } else {
      console.log('❌ TEST FAILED: Status did not update.');
    }

  } catch (err) {
    if (err.response && err.response.data) {
      console.error('Test failed:', err.response.data);
    } else {
      console.error('Test failed:', err.message);
    }
  }
}

test();
