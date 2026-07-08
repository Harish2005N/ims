// =============================================
// routes/productRoutes.js — REST API Endpoints
// =============================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/authMiddleware");

console.log("📦 productRoutes.js loaded — Transaction endpoints active.");

// ──────────────────────────────────────────────
// POST /api/products — Add a new product
// ──────────────────────────────────────────────
router.post("/", protect, authorize("admin", "seller"), async (req, res) => {
  try {
    const {
      productName,
      category,
      supplier,
      purchasePrice,
      sellingPrice,
      quantity,
      dateAdded,
      imageUrl,
    } = req.body;

    if (!productName || !category || !supplier || purchasePrice == null || sellingPrice == null) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const product = new Product({
      productName,
      category,
      supplier,
      purchasePrice,
      sellingPrice,
      quantity: quantity || 0,
      dateAdded: dateAdded || Date.now(),
      imageUrl: imageUrl || undefined, // Mongoose default will take over if empty
      sellerId: req.user.id,
    });

    const savedProduct = await product.save();
    res.status(201).json({ success: true, message: "Product added successfully", data: savedProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products — Get all products
router.get("/", protect, async (req, res) => {
  try {
    const { search, category, lowStock, myProducts, sort = "createdAt", order = "desc" } = req.query;

    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    let filter = {};
    
    if (req.user.role === "seller") {
      filter.sellerId = userObjectId;
    }

    if (myProducts === "true" && req.user.role === "admin") {
      filter.sellerId = userObjectId;
    }

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { supplier: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "all") filter.category = category;
    if (lowStock === "true") filter.quantity = { $lt: 10 };

    let products = await Product.find(filter).sort({ [sort]: order === "asc" ? 1 : -1 });

    // Hide purchasePrice for buyers
    if (req.user.role === "buyer") {
      products = products.map(p => {
        const obj = p.toObject();
        delete obj.purchasePrice;
        return obj;
      });
    }

    const totalProducts = await Product.countDocuments(filter);
    
    // Revenue Calculation (for sellers and admins)
    let totalRevenue = 0;
    if (req.user.role !== "buyer") {
      const transFilter = req.user.role === "seller" ? { sellerId: userObjectId } : {};
      const revenueData = await Transaction.aggregate([
        { $match: transFilter },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]);
      totalRevenue = revenueData[0]?.total || 0;
    }

    // Inventory Value (for admins)
    let totalInventoryValue = 0;
    if (req.user.role === "admin") {
      const valueData = await Product.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: { $multiply: ["$sellingPrice", "$quantity"] } } } }
      ]);
      totalInventoryValue = valueData[0]?.total || 0;
    }

    // Buyer Specific Stats (Total Spent & Units Bought)
    let totalSpent = 0;
    let unitsBought = 0;
    if (req.user.role === "buyer") {
      const buyerStats = await Transaction.aggregate([
        { $match: { buyerId: userObjectId } },
        { $group: { 
            _id: null, 
            spent: { $sum: "$totalAmount" },
            units: { $sum: "$quantity" } 
          }
        }
      ]);
      totalSpent = buyerStats[0]?.spent || 0;
      unitsBought = buyerStats[0]?.units || 0;
    }

    res.status(200).json({
      success: true,
      count: products.length,
      stats: {
        totalProducts,
        totalInventoryValue: totalInventoryValue.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        totalSpent: totalSpent.toFixed(2),
        unitsBought,
        lowStockCount: await Product.countDocuments({ ...filter, quantity: { $lt: 10 } }),
      },
      data: products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/transactions/my — Get buyer's purchase history
router.get("/transactions/my", protect, authorize("buyer"), async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const transactions = await Transaction.find({ buyerId: userObjectId })
      .sort({ purchaseDate: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/transactions/seller — Get incoming orders for a seller
router.get("/transactions/seller", protect, authorize("seller", "admin"), async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const filter = req.user.role === "seller" ? { sellerId: userObjectId } : {};
    const transactions = await Transaction.find(filter)
      .sort({ purchaseDate: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/products/transactions/:id/status — Update order status (Seller/Admin)
router.patch("/transactions/:id/status", protect, authorize("seller", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Security: Sellers can only update their own orders
    if (req.user.role === "seller" && transaction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to update this order" });
    }

    transaction.status = status;
    await transaction.save();

    res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:id — Get single product
router.get("/:id", protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    
    const obj = product.toObject();
    if (req.user.role === "buyer") {
      delete obj.purchasePrice;
    }
    
    res.status(200).json({ success: true, data: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/:id — Update product
router.put("/:id", protect, authorize("admin", "seller"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (req.user.role === "seller" && product.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to update this product" });
    }

    const { productId, ...updateData } = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true, runValidators: true });

    res.status(200).json({ success: true, message: "Product updated successfully", data: updatedProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id — Delete product
router.delete("/:id", protect, authorize("admin", "seller"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (req.user.role === "seller" && product.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products/:id/buy — Buy a product
router.post("/:id/buy", protect, authorize("buyer"), async (req, res) => {
  try {
    const { quantity = 1, paymentMethod } = req.body;
    const qtyToBuy = parseInt(quantity, 10);

    if (isNaN(qtyToBuy) || qtyToBuy <= 0) {
      return res.status(400).json({ success: false, message: "Invalid quantity" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (product.quantity < qtyToBuy) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Only ${product.quantity} units available.` });
    }

    // Decrement stock
    product.quantity -= qtyToBuy;
    await product.save();

    const totalAmount = product.sellingPrice * qtyToBuy;

    // Create Transaction record
    await Transaction.create({
      buyerId: req.user.id,
      productId: product._id,
      sellerId: product.sellerId,
      productName: product.productName,
      quantity: qtyToBuy,
      pricePerUnit: product.sellingPrice,
      totalAmount,
      paymentMethod: paymentMethod || "Cash",
      status: "pending",
    });

    res.status(200).json({ 
      success: true, 
      message: "Purchase successful", 
      remainingQuantity: product.quantity 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products/seed/data — Seed sample data
router.post("/seed/data", protect, authorize("admin"), async (req, res) => {
  try {
    await Product.deleteMany({});
    const mongoose = require("mongoose");
    const Counter = mongoose.model("Counter");
    await Counter.findByIdAndUpdate("productId", { seq: 0 }, { upsert: true });

    const sampleProducts = [
      { productName: "MacBook Pro 14\"", category: "Electronics", supplier: "Apple Inc.", purchasePrice: 1500, sellingPrice: 1999, quantity: 15, sellerId: req.user.id },
      { productName: "Wireless Mouse", category: "Electronics", supplier: "Logitech", purchasePrice: 20, sellingPrice: 45, quantity: 42, sellerId: req.user.id },
      { productName: "Office Chair", category: "Furniture", supplier: "Herman Miller", purchasePrice: 300, sellingPrice: 599, quantity: 8, sellerId: req.user.id },
      { productName: "Notebook A4", category: "Stationery", supplier: "Classmate", purchasePrice: 2, sellingPrice: 5, quantity: 200, sellerId: req.user.id },
      { productName: "USB-C Hub", category: "Electronics", supplier: "Anker", purchasePrice: 18, sellingPrice: 39, quantity: 7, sellerId: req.user.id },
      { productName: "Standing Desk", category: "Furniture", supplier: "FlexiSpot", purchasePrice: 250, sellingPrice: 499, quantity: 5, sellerId: req.user.id },
      { productName: "Protein Powder", category: "Health & Beauty", supplier: "MyProtein", purchasePrice: 25, sellingPrice: 55, quantity: 30, sellerId: req.user.id },
      { productName: "Running Shoes", category: "Sports", supplier: "Nike", purchasePrice: 60, sellingPrice: 120, quantity: 3, sellerId: req.user.id },
      { productName: "Cotton T-Shirt", category: "Clothing", supplier: "H&M", purchasePrice: 8, sellingPrice: 20, quantity: 75, sellerId: req.user.id },
      { productName: "HDMI Cable 2m", category: "Electronics", supplier: "Amazon Basics", purchasePrice: 5, sellingPrice: 12, quantity: 9, sellerId: req.user.id },
    ];

    await Product.insertMany(sampleProducts);

    res.status(201).json({ success: true, message: "Sample data seeded successfully", count: sampleProducts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
