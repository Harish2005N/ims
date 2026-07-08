const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/authMiddleware");

// @desc Register product
// @route POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Prevent Admin registration
    if (role === 'admin') {
      return res.status(403).json({ success: false, message: "Admin registration is not allowed" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const user = await User.create({ username, email, password, role });

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET || "fallback_secret_key_12345",
      { expiresIn: "30d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc Login user
// @route POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET || "fallback_secret_key_12345",
      { expiresIn: "30d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Get all users with activity stats (admin only)
// @route   GET /api/auth/users
router.get("/users", protect, authorize("admin"), async (req, res) => {
  try {
    // Get all non-admin users
    const users = await User.find({ role: { $ne: "admin" } })
      .select("-password")
      .sort({ role: 1, createdAt: -1 });

    // Get selling stats per seller
    const sellerStats = await Transaction.aggregate([
      { $group: {
          _id: "$sellerId",
          totalRevenue: { $sum: "$totalAmount" },
          totalOrdersReceived: { $sum: 1 },
          totalUnitsSold: { $sum: "$quantity" }
        }
      }
    ]);

    // Get buying stats per buyer
    const buyerStats = await Transaction.aggregate([
      { $group: {
          _id: "$buyerId",
          totalSpent: { $sum: "$totalAmount" },
          totalOrdersMade: { $sum: 1 },
          totalUnitsBought: { $sum: "$quantity" }
        }
      }
    ]);

    // Get product count per seller
    const productCounts = await Product.aggregate([
      { $group: { _id: "$sellerId", count: { $sum: 1 } } }
    ]);

    // Build lookup maps
    const sellerMap = {};
    sellerStats.forEach(s => { sellerMap[s._id.toString()] = s; });

    const buyerMap = {};
    buyerStats.forEach(b => { buyerMap[b._id.toString()] = b; });

    const productMap = {};
    productCounts.forEach(p => { productMap[p._id.toString()] = p.count; });

    // Enrich users with stats
    const enrichedUsers = users.map(u => {
      const uid = u._id.toString();
      const obj = u.toObject();

      if (u.role === "seller") {
        const ss = sellerMap[uid] || {};
        obj.totalProducts = productMap[uid] || 0;
        obj.totalRevenue = ss.totalRevenue || 0;
        obj.totalOrdersReceived = ss.totalOrdersReceived || 0;
        obj.totalUnitsSold = ss.totalUnitsSold || 0;
      } else if (u.role === "buyer") {
        const bs = buyerMap[uid] || {};
        obj.totalSpent = bs.totalSpent || 0;
        obj.totalOrdersMade = bs.totalOrdersMade || 0;
        obj.totalUnitsBought = bs.totalUnitsBought || 0;
      }

      return obj;
    });

    res.status(200).json({ success: true, count: enrichedUsers.length, data: enrichedUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
