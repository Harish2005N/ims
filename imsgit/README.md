# 📦 StockSense — Inventory Management System

A full-stack inventory management web application built with **HTML/CSS/JS**, **Node.js + Express**, and **MongoDB**.

---

## 📁 Project Structure

```
inventory-management/
│
├── backend/
│   ├── models/
│   │   └── Product.js          # Mongoose schema & model
│   ├── routes/
│   │   └── productRoutes.js    # REST API routes
│   ├── .env                    # Environment variables
│   ├── package.json            # Node dependencies
│   └── server.js               # Express server entry point
│
└── frontend/
    ├── css/
    │   └── style.css           # All styles
    ├── js/
    │   └── app.js              # Frontend JavaScript
    └── index.html              # Main HTML file
```

---

## ⚡ Features

| Feature | Details |
|---|---|
| ➕ Add Product | Form with validation for all product fields |
| ✏️ Edit Product | Pre-populated edit form via REST API |
| 🗑️ Delete Product | Confirmation modal before deletion |
| 📋 View All Products | Sortable table with all inventory |
| 🔍 Search | Real-time search by name, category, supplier |
| 📊 Dashboard | Stats: total products, inventory value, low stock count |
| ⚠️ Low Stock Alert | Visual warning when quantity < 10 |
| 🏷️ Category Filter | Filter by product category |
| 🌱 Sample Data | One-click seed with 10 sample products |

---

## 🔧 REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/products` | Add a new product |
| `GET` | `/api/products` | Get all products (supports search/filter query params) |
| `GET` | `/api/products/:id` | Get a single product |
| `PUT` | `/api/products/:id` | Update a product |
| `DELETE` | `/api/products/:id` | Delete a product |
| `POST` | `/api/products/seed/data` | Seed 10 sample products |

### Query Parameters for `GET /api/products`
- `?search=keyword` — Search by name, category, supplier, or productId
- `?category=Electronics` — Filter by category
- `?lowStock=true` — Show only items with qty < 10

---

## 🛠️ Prerequisites

Make sure these are installed on your machine:

1. **Node.js** (v16 or higher) — https://nodejs.org
2. **MongoDB** — Either:
   - Local: https://www.mongodb.com/try/download/community
   - Cloud (free): https://www.mongodb.com/atlas (MongoDB Atlas)

Verify installations:
```bash
node --version    # Should print v16.x or higher
mongod --version  # Should print MongoDB version
```

---

## 🚀 Installation & Setup

### Step 1: Clone / Download the project

```bash
# If using git:
git clone <your-repo-url>

# Or just extract the project folder
cd inventory-management
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

This installs:
- `express` — Web framework
- `mongoose` — MongoDB ODM
- `cors` — Cross-origin resource sharing
- `dotenv` — Environment variable loading
- `nodemon` — Auto-restart on file changes (dev)

### Step 3: Configure Environment Variables

Edit `backend/.env`:

```env
# For local MongoDB:
MONGO_URI=mongodb://localhost:27017/inventoryDB

# For MongoDB Atlas (cloud), replace with your connection string:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/inventoryDB

PORT=5000
```

### Step 4: Start MongoDB (local only)

If using a local MongoDB installation:
```bash
# On macOS/Linux:
mongod

# On Windows (run as Administrator):
net start MongoDB
```

If using MongoDB Atlas, skip this step — just update your `MONGO_URI` in `.env`.

### Step 5: Run the Backend Server

```bash
# From the backend/ directory:

# Development mode (auto-restarts on changes):
npm run dev

# OR Production mode:
npm start
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server running at http://localhost:5000
```

### Step 6: Open the Frontend

Simply open `frontend/index.html` in your browser:

```bash
# On macOS:
open ../frontend/index.html

# On Windows:
start ../frontend/index.html

# On Linux:
xdg-open ../frontend/index.html
```

**Or** navigate to `http://localhost:5000` in your browser — the backend serves the frontend automatically.

---

## 🌱 Load Sample Data

Once the app is running, click the **"Load Sample Data"** button in the sidebar to populate the database with 10 test products.

Or call the API directly:
```bash
curl -X POST http://localhost:5000/api/products/seed/data
```

### Sample Products Included:
| Product | Category | Qty | Selling Price |
|---------|----------|-----|---------------|
| MacBook Pro 14" | Electronics | 15 | ₹1,999 |
| Wireless Mouse | Electronics | 42 | ₹45 |
| Office Chair | Furniture | 8 | ₹599 |
| Notebook A4 | Stationery | 200 | ₹5 |
| USB-C Hub | Electronics | 7 | ₹39 |
| Standing Desk | Furniture | 5 | ₹499 |
| Protein Powder | Health & Beauty | 30 | ₹55 |
| Running Shoes | Sports | 3 | ₹120 |
| Cotton T-Shirt | Clothing | 75 | ₹20 |
| HDMI Cable 2m | Electronics | 9 | ₹12 |

*(Note: Office Chair, USB-C Hub, Standing Desk, Running Shoes, and HDMI Cable all have qty < 10 — they will trigger the low stock alert!)*

---

## 🧪 Testing the API with curl

```bash
# Add a product
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{"productName":"Test Product","category":"Electronics","supplier":"Test Co","purchasePrice":100,"sellingPrice":150,"quantity":25}'

# Get all products
curl http://localhost:5000/api/products

# Search products
curl "http://localhost:5000/api/products?search=chair"

# Get low stock items
curl "http://localhost:5000/api/products?lowStock=true"

# Update a product (replace ID with actual MongoDB _id)
curl -X PUT http://localhost:5000/api/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{"quantity":50}'

# Delete a product
curl -X DELETE http://localhost:5000/api/products/PRODUCT_ID
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `MongoDB connection failed` | Make sure `mongod` is running locally, or check your Atlas URI |
| `EADDRINUSE: port 5000` | Another process is using port 5000. Change `PORT=5001` in `.env` |
| Frontend shows "Failed to load" | Make sure the backend is running on port 5000 |
| `npm: command not found` | Install Node.js from https://nodejs.org |
| CORS errors in browser | Backend already includes `cors` middleware — ensure you're fetching from the right port |

---

## 📝 Product Schema Reference

```javascript
{
  productId:     String,   // Auto-generated: PRD-0001, PRD-0002, ...
  productName:   String,   // Required, max 100 chars
  category:      String,   // Required, one of 10 preset categories
  supplier:      String,   // Required
  purchasePrice: Number,   // Required, min 0
  sellingPrice:  Number,   // Required, min 0
  quantity:      Number,   // Required, min 0, default 0
  dateAdded:     Date,     // Default: current date
  createdAt:     Date,     // Auto (Mongoose timestamps)
  updatedAt:     Date,     // Auto (Mongoose timestamps)

  // Virtual fields (computed, not stored):
  profitMargin:  String,   // e.g. "33.3"
  totalValue:    String,   // sellingPrice × quantity
  isLowStock:    Boolean   // quantity < 10
}
```

---

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Icons**: Phosphor Icons
- **Fonts**: Syne (display) + DM Sans (body) via Google Fonts
