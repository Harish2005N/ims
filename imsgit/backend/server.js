// =============================================
// server.js — Main Entry Point
// =============================================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ── Middleware ────────────────────────────────
app.use(cors()); // Allow cross-origin requests (frontend ↔ backend)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// ── API Routes ────────────────────────────────
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);

// Health check to verify backend version
app.get("/api/health", (req, res) => {
  res.json({ success: true, version: "2.1.0-with-transactions", timestamp: new Date() });
});

// ── Root Route (serves frontend) ─────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ── 404 Handler ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global Error Handler ──────────────────────
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
});

// ── Connect to MongoDB & Start Server ─────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/inventoryDB";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_12345";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`✅ Transaction routes are registered at /api/products/transactions/*`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
