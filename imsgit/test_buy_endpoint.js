const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Product = require('./backend/models/Product');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5000/api';
const JWT_SECRET = 'fallback_secret_key_12345';

async function testBuy() {
  await mongoose.connect('mongodb://localhost:27017/inventoryDB');
  
  // Find or create buyer
  let buyer = await User.findOne({ role: 'buyer' });
  if (!buyer) {
    buyer = await User.create({
      username: 'Test Buyer',
      email: 'buyer_diag@test.com',
      password: 'password123',
      role: 'buyer'
    });
  }
  
  const token = jwt.sign({ id: buyer._id, role: buyer.role }, JWT_SECRET);
  
  // Find a product
  const product = await Product.findOne();
  if (!product) {
    console.log("No products found to buy");
    process.exit(0);
  }
  
  console.log(`Testing BUY on product: ${product.productName} (${product._id})`);
  
  try {
    const res = await axios.post(`${API_URL}/products/${product._id}/buy`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.status : err.message);
    if (err.response) console.error("Data:", err.response.data);
  }
  
  process.exit(0);
}

testBuy();
