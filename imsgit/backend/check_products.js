const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/inventoryDB";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    const products = await Product.find({});
    console.log(`Found ${products.length} products`);
    
    const missingSeller = products.filter(p => !p.sellerId);
    console.log(`Products missing sellerId: ${missingSeller.length}`);
    
    missingSeller.forEach(p => {
      console.log(`- ${p.productName} (ID: ${p._id})`);
    });

    process.exit(0);
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
