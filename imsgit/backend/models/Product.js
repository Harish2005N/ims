// =============================================
// models/Product.js — Mongoose Schema
// =============================================

const mongoose = require("mongoose");

// Counter schema to auto-generate readable product IDs (e.g. PRD-0001)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", counterSchema);

// ── Product Schema ────────────────────────────
const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      unique: true,
      // Auto-generated before save (see pre-save hook below)
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: [
        "Electronics",
        "Clothing",
        "Food & Beverages",
        "Furniture",
        "Stationery",
        "Health & Beauty",
        "Sports",
        "Toys",
        "Automotive",
        "Other",
      ],
    },
    supplier: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required"],
      min: [0, "Purchase price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Seller ID is required"],
    },
    imageUrl: {
      type: String,
      default: "https://placehold.co/400x400/1e293b/white?text=No+Image",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: Profit Margin ─────────────────────
productSchema.virtual("profitMargin").get(function () {
  if (this.purchasePrice === 0) return 0;
  return (
    (((this.sellingPrice - this.purchasePrice) / this.purchasePrice) * 100).toFixed(2)
  );
});

// ── Virtual: Total Stock Value ─────────────────
productSchema.virtual("totalValue").get(function () {
  return (this.sellingPrice * this.quantity).toFixed(2);
});

// ── Virtual: Low Stock Flag ────────────────────
productSchema.virtual("isLowStock").get(function () {
  return this.quantity < 10;
});

// ── Pre-save Hook: Auto-generate productId ─────
productSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        "productId",
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.productId = `PRD-${String(counter.seq).padStart(4, "0")}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// ── Index for fast text search ─────────────────
productSchema.index({ productName: "text", category: "text", supplier: "text" });

module.exports = mongoose.model("Product", productSchema);
