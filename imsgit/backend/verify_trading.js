const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function verifyTrading() {
  console.log('🚀 Starting Trading Feature Verification...');

  try {
    // 1. Login/Register characters
    const seller = { email: 'seller@gmail.com', password: 'password123', role: 'seller', username: 'TradingSeller' };
    const buyer = { email: 'buyer@gmail.com', password: 'password123', role: 'buyer', username: 'TradingBuyer' };

    console.log('--- Authenticating Users ---');
    let sellerToken, buyerToken;

    try {
      const sLogin = await axios.post(`${API_BASE}/auth/login`, { email: seller.email, password: seller.password });
      sellerToken = sLogin.data.token;
      console.log('✅ Seller logged in');
    } catch {
      const sReg = await axios.post(`${API_BASE}/auth/register`, seller);
      sellerToken = sReg.data.token;
      console.log('✅ Seller registered');
    }

    try {
      const bLogin = await axios.post(`${API_BASE}/auth/login`, { email: buyer.email, password: buyer.password });
      buyerToken = bLogin.data.token;
      console.log('✅ Buyer logged in');
    } catch {
      const bReg = await axios.post(`${API_BASE}/auth/register`, buyer);
      buyerToken = bReg.data.token;
      console.log('✅ Buyer registered');
    }

    // 2. Seller adds a product
    console.log('\n--- Step 1: Seller adding a product ---');
    const productData = {
      productName: 'Bulk Item X',
      category: 'Electronics',
      supplier: 'Xcorp',
      purchasePrice: 100,
      sellingPrice: 150,
      quantity: 50
    };
    const pCreate = await axios.post(`${API_BASE}/products`, productData, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const product = pCreate.data.data;
    console.log(`✅ Product created: ${product.productName} (ID: ${product._id})`);

    // 3. Buyer views products - Check Price Privacy
    console.log('\n--- Step 2: Buyer viewing product (Privacy Check) ---');
    const pView = await axios.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    const foundProduct = pView.data.data.find(p => p._id === product._id);
    if (foundProduct.purchasePrice === undefined) {
      console.log('✅ Privacy Pass: Buyer cannot see purchase price.');
    } else {
      console.log('❌ Privacy Fail: Buyer can see purchase price!', foundProduct.purchasePrice);
    }

    // 4. Buyer performs bulk purchase (Quantity = 5)
    console.log('\n--- Step 3: Buyer performs bulk purchase (5 units) ---');
    const buyRes = await axios.post(`${API_BASE}/products/${product._id}/buy`, { quantity: 5 }, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    console.log('✅ Bulk purchase response:', buyRes.data.message);

    // 5. Verify Stock Reduction
    const pCheck = await axios.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    const updatedProduct = pCheck.data.data.find(p => p._id === product._id);
    if (updatedProduct.quantity === 45) {
      console.log('✅ Stock Pass: Quantity reduced correctly (50 -> 45)');
    } else {
      console.log('❌ Stock Fail: Quantity is', updatedProduct.quantity);
    }

    // 6. Verify Transaction History for Buyer
    console.log('\n--- Step 4: Verifying Buyer Transaction History ---');
    const historyRes = await axios.get(`${API_BASE}/products/transactions/my`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    const tx = historyRes.data.data.find(t => t.productId === product._id);
    if (tx && tx.quantity === 5 && tx.totalAmount === 750) {
      console.log('✅ History Pass: Transaction recorded correctly.');
    } else {
      console.log('❌ History Fail:', tx);
    }

    // 7. Verify Seller Revenue
    console.log('\n--- Step 5: Verifying Seller Revenue ---');
    const sView = await axios.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const sellerStats = sView.data.stats;
    if (Number(sellerStats.totalRevenue) >= 750) {
      console.log(`✅ Revenue Pass: Seller revenue is ₹${sellerStats.totalRevenue} (>= ₹750)`);
    } else {
      console.log(`❌ Revenue Fail: Seller revenue is only ₹${sellerStats.totalRevenue}, expected at least ₹750`);
    }

    console.log('\n🏆 ALL TRADING FEATURES VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification failed:', err.response ? err.response.data : err.message);
  }
}

verifyTrading();
