const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/inventoryDB';

async function seedProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find admin user to use as sellerId
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ No admin user found. Run reset_admin.js first.');
      process.exit(1);
    }
    console.log(`📌 Using admin "${admin.email}" as seller for seeded products`);

    // Reset counter
    const Counter = mongoose.model('Counter');
    await Counter.findByIdAndUpdate('productId', { seq: 0 }, { upsert: true });
    console.log('🔄 Counter reset');

    // Delete existing products
    const delRes = await Product.deleteMany({});
    console.log(`🗑️ Deleted ${delRes.deletedCount} existing products`);

    // Seed products one-by-one so pre-save hook generates productId
    const sampleProducts = [
      { productName: 'MacBook Pro 14"', category: 'Electronics', supplier: 'Apple Inc.', purchasePrice: 1500, sellingPrice: 1999, quantity: 15 },
      { productName: 'Wireless Mouse', category: 'Electronics', supplier: 'Logitech', purchasePrice: 20, sellingPrice: 45, quantity: 42 },
      { productName: 'Office Chair', category: 'Furniture', supplier: 'Herman Miller', purchasePrice: 300, sellingPrice: 599, quantity: 8 },
      { productName: 'Notebook A4', category: 'Stationery', supplier: 'Classmate', purchasePrice: 2, sellingPrice: 5, quantity: 200 },
      { productName: 'USB-C Hub', category: 'Electronics', supplier: 'Anker', purchasePrice: 18, sellingPrice: 39, quantity: 7 },
      { productName: 'Standing Desk', category: 'Furniture', supplier: 'FlexiSpot', purchasePrice: 250, sellingPrice: 499, quantity: 5 },
      { productName: 'Protein Powder', category: 'Health & Beauty', supplier: 'MyProtein', purchasePrice: 25, sellingPrice: 55, quantity: 30 },
      { productName: 'Running Shoes', category: 'Sports', supplier: 'Nike', purchasePrice: 60, sellingPrice: 120, quantity: 3 },
      { productName: 'Cotton T-Shirt', category: 'Clothing', supplier: 'H&M', purchasePrice: 8, sellingPrice: 20, quantity: 75 },
      { productName: 'HDMI Cable 2m', category: 'Electronics', supplier: 'Amazon Basics', purchasePrice: 5, sellingPrice: 12, quantity: 9 },
    ];

    for (const p of sampleProducts) {
      const product = new Product({ ...p, sellerId: admin._id });
      await product.save();
      console.log(`  ✅ ${product.productId} — ${product.productName}`);
    }

    console.log(`\n🎉 Successfully seeded ${sampleProducts.length} products!`);

    await mongoose.connection.close();
    console.log('👋 Disconnected');
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  }
}

seedProducts();
