// =============================================
// app.js — StockSense Frontend Application
// =============================================

// ── Configuration ─────────────────────────────
const API_BASE = "/api";

// ── App State ─────────────────────────────────
const TOKEN = localStorage.getItem("token");
const USER  = JSON.parse(localStorage.getItem("user") || "{}");

let allProducts = [];          // cached product list
let deleteTargetId = null;     // product ID awaiting delete confirmation
let buyTargetId = null;        // product ID being bought
let buyProductPrice = 0;       // cached price for total calculation
let searchTimeout = null;      // debounce timer for search

// ── Auth Check ───────────────────────────────
if (!TOKEN && !window.location.pathname.includes("login.html")) {
  window.location.href = "login.html";
}

// ══════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Format a number as Indian Rupee currency
 */
function formatCurrency(amount) {
  if (isNaN(amount) || amount === null) return "₹0";
  return "₹" + Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a date string as DD/MM/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN");
}

/**
 * Get stock status badge HTML based on quantity
 */
function getStockBadge(qty) {
  if (qty === 0) {
    return `<span class="badge badge-critical"><i class="ph-bold ph-x-circle"></i> Out of Stock</span>`;
  } else if (qty < 10) {
    return `<span class="badge badge-low"><i class="ph-bold ph-warning"></i> Low Stock</span>`;
  }
  return `<span class="badge badge-ok"><i class="ph-bold ph-check-circle"></i> In Stock</span>`;
}

// ══════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const icons = {
    success: "ph-check-circle",
    error:   "ph-x-circle",
    warning: "ph-warning",
    info:    "ph-info",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="ph-bold ${icons[type]} toast-icon"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove after 3.5 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(24px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

// ══════════════════════════════════════════════
// PAGE NAVIGATION (SPA-style routing)
// ══════════════════════════════════════════════
function navigateTo(pageId, options = {}) {
  // Role-based redirection: Buyers don't have a dashboard
  if (pageId === "dashboard" && USER.role === "buyer") {
    return navigateTo("products");
  }

  // Hide all pages
  document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));

  // Show target page
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) targetPage.style.display = "block";

  // Update sidebar active state
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });

  // Update topbar title
  const titles = {
    dashboard:   USER.role === "admin" ? "Inventory Overview" : "Company Overview",
    products:    "Products",
    "add-product": "Add Product",
    purchases:   "My Purchase History",
    orders:      "Incoming Orders",
    users:       "Users Management"
  };
  document.getElementById("page-title").textContent = titles[pageId] || pageId;

  // Update dashboard header text
  if (pageId === "dashboard") {
    const pageTitle = document.querySelector("#page-dashboard .page-title");
    const pageSubtitle = document.querySelector("#page-dashboard .page-subtitle");
    if (pageTitle) pageTitle.textContent = USER.role === "admin" ? "Analytics Dashboard" : "My Business Stats";
    if (pageSubtitle) pageSubtitle.innerText = `Welcome back, ${USER.username || "User"} (${USER.role}) — here's your ${USER.role === "admin" ? "global inventory" : "company"} snapshot`;
  }

  // Close mobile sidebar
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");

  // Trigger page-specific logic
  switch (pageId) {
    case "dashboard":
      loadDashboard();
      break;
    case "products":
      loadProducts(options);
      break;
    case "add-product":
      if (!options.edit) resetForm();
      break;
    case "purchases":
      loadPurchases();
      break;
    case "orders":
      loadOrders();
      break;
    case "users":
      loadUsers();
      break;
  }
}

// ══════════════════════════════════════════════
// API: FETCH ALL PRODUCTS
// ══════════════════════════════════════════════
async function fetchProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.search)   query.set("search", params.search);
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.lowStock) query.set("lowStock", "true");
  if (params.myProducts) query.set("myProducts", "true");

  const url = `${API_BASE}/products${query.toString() ? "?" + query : ""}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${TOKEN}`
    }
  });
  if (res.status === 401) logout();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ══════════════════════════════════════════════
// DASHBOARD PAGE
// ══════════════════════════════════════════════
async function loadDashboard() {
  const loading = document.getElementById("dashboard-loading");
  const wrapper = document.getElementById("dashboard-table-wrapper");
  const empty   = document.getElementById("dashboard-empty");

  loading.style.display = "flex";
  wrapper.style.display = "none";
  empty.style.display   = "none";

  try {
    const response = await fetchProducts();
    allProducts = response.data;
    updateStats(response.stats);
    checkLowStockAlert(response.stats);

    loading.style.display = "none";

    // Show last 8 products on dashboard
    const recent = [...allProducts].reverse().slice(0, 8);

    if (recent.length === 0) {
      empty.style.display = "flex";
      return;
    }

    wrapper.style.display = "block";
    const tbody = document.getElementById("dashboard-tbody");
    tbody.innerHTML = recent.map((p) => `
      <tr>
        <td class="td-id">${p.productId || "—"}</td>
        <td class="td-name">${escHtml(p.productName)}</td>
        <td><span class="category-tag">${escHtml(p.category)}</span></td>
        <td>${p.quantity}</td>
        <td class="td-price">${formatCurrency(p.sellingPrice)}</td>
        <td>${getStockBadge(p.quantity)}</td>
      </tr>
    `).join("");

  } catch (err) {
    loading.style.display = "none";
    empty.style.display   = "flex";
    showToast("Failed to load dashboard data: " + err.message, "error");
  }
}

function updateStats(stats) {
  // Total Products / Units Bought
  const totalProductsEl = document.getElementById("stat-total-products");
  const totalProductsLabel = document.getElementById("stat-total-label");
  if (totalProductsEl) {
    totalProductsEl.textContent = USER.role === "buyer" ? (stats.unitsBought ?? 0) : (stats.totalProducts ?? 0);
  }
  if (totalProductsLabel) {
    totalProductsLabel.textContent = USER.role === "buyer" ? "Units Bought" : "Total Products";
  }
  
  // Inventory Value / Total Spent
  const valueCard = document.getElementById("stat-value-card");
  const totalValueEl = document.getElementById("stat-total-value");
  const valueLabel = document.getElementById("stat-value-label");
  
  if (valueCard) {
    // Hide "Asset Value" for sellers as requested
    valueCard.style.display = (USER.role === "seller") ? "none" : "flex";
  }

  if (totalValueEl) {
    totalValueEl.textContent = USER.role === "buyer" ? formatCurrency(stats.totalSpent) : formatCurrency(stats.totalInventoryValue);
  }
  if (valueLabel) {
    if (USER.role === "buyer") {
      valueLabel.textContent = "Total Spent";
    } else {
      valueLabel.textContent = "Inventory Value";
    }
  }

  // Stats labels and cards
  const revenueCard = document.getElementById("stat-revenue-card");
  const revenueVal = document.getElementById("stat-total-revenue");

  if (USER.role !== "buyer") {
    if (revenueCard && revenueVal) {
      revenueCard.style.display = "flex";
      revenueVal.textContent = formatCurrency(stats.totalRevenue);
    }
  }

  if (document.getElementById("stat-low-stock"))
    document.getElementById("stat-low-stock").textContent      = stats.lowStockCount ?? 0;
  if (document.getElementById("stat-showing"))
    document.getElementById("stat-showing").textContent        = allProducts.length;

  // Update sidebar badge (Admins and Sellers only)
  if (USER.role !== "buyer") {
    const badge = document.getElementById("low-stock-badge");
    if (badge) {
      badge.textContent = stats.lowStockCount ?? 0;
      badge.style.display = (stats.lowStockCount > 0) ? "inline" : "none";
    }
  }
}

function checkLowStockAlert(stats) {
  const banner = document.getElementById("low-stock-alert");
  if (stats.lowStockCount > 0) {
    document.getElementById("alert-message").textContent =
      `${stats.lowStockCount} product${stats.lowStockCount > 1 ? "s have" : " has"} fewer than 10 units remaining.`;
    banner.style.display = "flex";
  } else {
    banner.style.display = "none";
  }
}

// ══════════════════════════════════════════════
// PRODUCTS PAGE
// ══════════════════════════════════════════════
async function loadProducts(options = {}) {
  const loading = document.getElementById("products-loading");
  const wrapper = document.getElementById("products-table-wrapper");
  const empty   = document.getElementById("products-empty");

  loading.style.display = "flex";
  wrapper.style.display = "none";
  empty.style.display   = "none";

  // Apply low stock filter from nav
  if (options.filter === "lowStock") {
    document.getElementById("low-stock-filter").checked = true;
  }

  try {
    const search   = document.getElementById("search-input").value.trim();
    const category = document.getElementById("category-filter").value;
    const lowStock = document.getElementById("low-stock-filter").checked;
    const myProducts = options.filter === "myProducts";

    const response = await fetchProducts({ search, category, lowStock, myProducts });
    allProducts = response.data;
    updateStats(response.stats);

    loading.style.display = "none";

    if (allProducts.length === 0) {
      empty.style.display = "flex";
      return;
    }

    wrapper.style.display = "block";
    renderProductsTable(allProducts);

  } catch (err) {
    loading.style.display = "none";
    empty.style.display   = "flex";
    showToast("Failed to load products: " + err.message, "error");
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById("products-tbody");

  // Hide purchase price header for buyers
  const thPrice = document.querySelector(".th-purchase-price");
  if (thPrice) thPrice.style.display = USER.role === "buyer" ? "none" : "table-cell";
  tbody.innerHTML = products.map((p) => {
    const totalVal = (p.sellingPrice * p.quantity).toFixed(2);
    const thumb = p.imageUrl || `https://placehold.co/40x40/1e293b/white?text=${p.productName.charAt(0)}`;

    return `
    <tr data-id="${p._id}">
      <td class="id-cell">${p.productId || p._id.slice(-6).toUpperCase()}</td>
      <td class="product-cell">
        <img src="${thumb}" class="product-thumb" onerror="this.src='https://placehold.co/40x40/1e293b/white?text=?'">
        <div class="product-name-stack">
          <strong>${escHtml(p.productName)}</strong>
          <span class="subtext text-muted" style="font-size:0.75rem">${escHtml(p.category)}</span>
        </div>
      </td>
      <td>${escHtml(p.category)}</td>
      <td>${escHtml(p.supplier)}</td>
      <td style="display: ${USER.role === 'buyer' ? 'none' : 'table-cell'}">${formatCurrency(p.purchasePrice)}</td>
      <td class="td-price">${formatCurrency(p.sellingPrice)}</td>
      <td><strong>${p.quantity}</strong></td>
      <td>${formatCurrency(totalVal)}</td>
      <td>${getStockBadge(p.quantity)}</td>
      <td>
        <div class="td-actions">
          ${USER.role === "buyer" ? `
            <button class="btn btn-sm btn-primary" onclick="openBuyModal('${p._id}', '${escAttr(p.productName)}', ${p.sellingPrice}, ${p.quantity})" title="Buy Product" ${p.quantity <= 0 ? "disabled" : ""}>
              <i class="ph-bold ph-shopping-cart"></i> Buy
            </button>
          ` : ""}
          ${(USER.role === "admin" || (USER.role === "seller" && p.sellerId === USER.id)) ? `
            <button class="btn btn-icon btn-edit" onclick="editProduct('${p._id}')" title="Edit">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
          ` : ""}
          ${(USER.role === "admin" || (USER.role === "seller" && p.sellerId === USER.id)) ? `
            <button class="btn btn-icon btn-delete" onclick="confirmDelete('${p._id}', '${escAttr(p.productName)}')" title="Delete">
              <i class="ph-bold ph-trash"></i>
            </button>
          ` : ""}
        </div>
      </td>
    </tr>
    `;
  }).join("");
}

// ══════════════════════════════════════════════
// ADD / EDIT PRODUCT FORM
// ══════════════════════════════════════════════
function resetForm() {
  document.getElementById("product-form").reset();
  document.getElementById("edit-product-id").value = "";
  document.getElementById("form-page-title").textContent = "Add Product";
  document.getElementById("form-page-subtitle").textContent = "Fill in the details to add a new product";
  document.getElementById("submit-btn-text").textContent = "Save Product";
  document.getElementById("profit-preview").style.display = "none";

  // Set today's date as default
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("f-dateAdded").value = today;

  clearFieldErrors();
}

async function editProduct(productId) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    if (res.status === 401) logout();
    if (!res.ok) throw new Error("Product not found");
    const { data: p } = await res.json();

    // Switch to form page
    navigateTo("add-product", { edit: true });

    // Populate form
    document.getElementById("edit-product-id").value  = p._id;
    document.getElementById("f-productName").value    = p.productName;
    document.getElementById("f-category").value       = p.category;
    document.getElementById("f-supplier").value       = p.supplier;
    document.getElementById("f-purchasePrice").value  = p.purchasePrice;
    document.getElementById("f-sellingPrice").value   = p.sellingPrice;
    document.getElementById("f-quantity").value       = p.quantity;
    document.getElementById("f-imageUrl").value = p.imageUrl || "";
    
    const formDate = p.dateAdded ? new Date(p.dateAdded).toISOString().split('T')[0] : '';
    document.getElementById("f-dateAdded").value = formDate;

    document.getElementById("form-page-title").textContent    = "Edit Product";
    document.getElementById("form-page-subtitle").textContent = `Editing: ${p.productName}`;
    document.getElementById("submit-btn-text").textContent    = "Update Product";

    updateProfitPreview();
    clearFieldErrors();

  } catch (err) {
    showToast("Failed to load product: " + err.message, "error");
  }
}

// Form submit: add or update
document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const editId = document.getElementById("edit-product-id").value;
  const isEdit = Boolean(editId);

  const payload = {
    productName:   document.getElementById("f-productName").value.trim(),
    category:      document.getElementById("f-category").value,
    supplier:      document.getElementById("f-supplier").value.trim(),
    purchasePrice: parseFloat(document.getElementById("f-purchasePrice").value),
    sellingPrice:  parseFloat(document.getElementById("f-sellingPrice").value),
    quantity: parseInt(document.getElementById("f-quantity").value, 10),
    dateAdded: document.getElementById("f-dateAdded").value || undefined,
    imageUrl: document.getElementById("f-imageUrl").value || undefined,
  };

  const submitBtn = document.getElementById("form-submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Saving…`;

  try {
    const url    = isEdit ? `${API_BASE}/products/${editId}` : `${API_BASE}/products`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Failed to save product", "error");
      return;
    }

    showToast(
      isEdit ? `"${payload.productName}" updated successfully!` : `"${payload.productName}" added successfully!`,
      "success"
    );

    navigateTo("products");

  } catch (err) {
    showToast("Network error: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="ph-bold ph-floppy-disk"></i> <span id="submit-btn-text">${isEdit ? "Update Product" : "Save Product"}</span>`;
  }
});

async function openBuyModal(productId, productName, price, maxQty) {
  buyTargetId = productId;
  buyProductPrice = price;
  
  document.getElementById("buy-modal-title").innerText = `Buy ${productName}`;
  document.getElementById("buy-max-label").innerText = `(Available: ${maxQty})`;
  document.getElementById("buy-qty").max = maxQty;
  document.getElementById("buy-qty").value = 1;
  document.getElementById("buy-total-display").innerText = formatCurrency(price);
  
  document.getElementById("buy-modal").style.display = "flex";
}

// Qty listener for total calculation
document.getElementById("buy-qty").addEventListener("input", (e) => {
  const qty = parseInt(e.target.value, 10) || 0;
  const total = qty * buyProductPrice;
  document.getElementById("buy-total-display").innerText = formatCurrency(total);
});

document.getElementById("buy-cancel-btn").addEventListener("click", () => {
  document.getElementById("buy-modal").style.display = "none";
  buyTargetId = null;
});

document.getElementById("buy-confirm-btn").addEventListener("click", async () => {
  if (!buyTargetId) return;
  const qty = parseInt(document.getElementById("buy-qty").value, 10);
  const payment = document.getElementById("buy-payment").value;
  
  const btn = document.getElementById("buy-confirm-btn");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>`;
  
  await buyProduct(buyTargetId, qty, payment);
  
  btn.disabled = false;
  btn.innerHTML = `<i class="ph-bold ph-check-circle"></i> Confirm Purchase`;
  document.getElementById("buy-modal").style.display = "none";
});

async function buyProduct(productId, quantity = 1, paymentMethod = "Cash") {
  console.log(`[BUY] Attempting to buy product ${productId} with quantity ${quantity} via ${paymentMethod}`);
  try {
    const res = await fetch(`${API_BASE}/products/${productId}/buy`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}` 
      },
      body: JSON.stringify({ quantity, paymentMethod })
    });
    
    console.log(`[BUY] Response Status: ${res.status}`);
    const data = await res.json();
    console.log(`[BUY] Response Body:`, data);

    if (!res.ok) {
      showToast(data.message || "Purchase failed", "error");
      return;
    }

    showToast("Purchase successful!", "success");
    
    // Determine active page and refresh appropriately
    const activeNav = document.querySelector(".nav-item.active");
    const activePage = activeNav ? activeNav.dataset.page : "products";
    
    if (activePage === "products") {
      loadProducts();
    } else if (activePage === "dashboard") {
      loadDashboard();
    } else if (activePage === "purchases") {
      loadPurchases();
    } else if (activePage === "orders") {
      loadOrders();
    } else {
      loadProducts(); // fallback
    }

    // Always fetch latest stats to update dashboard/sidebar badges
    const resStats = await fetchProducts();
    updateStats(resStats.stats);

  } catch (err) {
    console.error(`[BUY] Network/Execution Error:`, err);
    showToast("Network error: " + err.message, "error");
  }
}

// ──────────────────────────────────────────────
// PURCHASE HISTORY LOGIC
// ──────────────────────────────────────────────
async function loadPurchases() {
  const loading = document.getElementById("purchases-loading");
  const wrapper = document.getElementById("purchases-table-wrapper");
  const empty = document.getElementById("purchases-empty");
  const tbody = document.getElementById("purchases-tbody");

  if (!loading || !wrapper || !empty || !tbody) return;

  loading.style.display = "block";
  wrapper.style.display = "none";
  empty.style.display = "none";
  tbody.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/products/transactions/my`, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      }
    });

    const result = await res.json();
    loading.style.display = "none";

    if (result.success && result.data.length > 0) {
      renderPurchasesTable(result.data);
      wrapper.style.display = "block";
    } else {
      empty.style.display = "block";
    }
  } catch (err) {
    loading.style.display = "none";
    showToast("Error loading purchases", "error");
  }
}

function renderPurchasesTable(transactions) {
  const tbody = document.getElementById("purchases-tbody");
  tbody.innerHTML = "";

  transactions.forEach(t => {
    const tr = document.createElement("tr");
    const dateStr = new Date(t.purchaseDate).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const thumb = t.imageUrl || "https://placehold.co/40x40/1e293b/white?text=" + t.productName.charAt(0);

    const statusClass = t.status === 'pending' ? 'badge-amber' : 
                        t.status === 'paid' ? 'badge-blue' : 
                        t.status === 'shipped' ? 'badge-purple' : 
                        t.status === 'delivered' ? 'badge-green' : 'badge-outline';

    tr.innerHTML = `
      <td class="id-cell">${dateStr}</td>
      <td class="product-cell">
        <img src="${thumb}" class="product-thumb" onerror="this.src='https://placehold.co/40x40/1e293b/white?text=?'">
        <div class="product-name-stack">
          <strong>${escHtml(t.productName)}</strong>
          <span class="subtext text-muted" style="font-size:0.75rem">${escHtml(t.category)}</span>
        </div>
      </td>
      <td>${t.quantity}</td>
      <td>${formatCurrency(t.pricePerUnit)}</td>
      <td class="total-cell">${formatCurrency(t.totalAmount)}</td>
      <td><span class="badge ${statusClass}">${(t.status || 'pending').toUpperCase()}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════════
// DELETE PRODUCT
// ══════════════════════════════════════════════
function confirmDelete(productId, productName) {
  deleteTargetId = productId;
  document.getElementById("delete-modal-text").textContent =
    `Are you sure you want to delete "${productName}"? This cannot be undone.`;
  document.getElementById("delete-modal").style.display = "flex";
}

document.getElementById("delete-cancel-btn").addEventListener("click", () => {
  document.getElementById("delete-modal").style.display = "none";
  deleteTargetId = null;
});

document.getElementById("delete-confirm-btn").addEventListener("click", async () => {
  if (!deleteTargetId) return;

  const btn = document.getElementById("delete-confirm-btn");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>`;

  try {
    const res  = await fetch(`${API_BASE}/products/${deleteTargetId}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    if (res.status === 401) logout();
    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Failed to delete product", "error");
      return;
    }

    showToast(data.message || "Product deleted", "success");
    document.getElementById("delete-modal").style.display = "none";
    deleteTargetId = null;
    loadProducts();

  } catch (err) {
    showToast("Network error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-trash"></i> Delete`;
  }
});

// ══════════════════════════════════════════════
// SEED SAMPLE DATA
// ══════════════════════════════════════════════
document.getElementById("seed-btn").addEventListener("click", async () => {
  if (!confirm("This will clear all existing products and load 10 sample products. Continue?")) return;

  const btn = document.getElementById("seed-btn");
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> <span>Seeding…</span>`;

  try {
    const res  = await fetch(`${API_BASE}/products/seed/data`, { 
      method: "POST",
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    if (res.status === 401) logout();
    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Seed failed", "error");
      return;
    }

    showToast(`Loaded ${data.count} sample products!`, "success");
    navigateTo("dashboard");

  } catch (err) {
    showToast("Seed error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-database"></i> <span>Load Sample Data</span>`;
  }
});

// ══════════════════════════════════════════════
// FORM VALIDATION
// ══════════════════════════════════════════════
function validateForm() {
  let valid = true;
  clearFieldErrors();

  const fields = [
    { id: "f-productName", errId: "err-productName", label: "Product name" },
    { id: "f-category",    errId: "err-category",    label: "Category" },
    { id: "f-supplier",    errId: "err-supplier",    label: "Supplier" },
    { id: "f-purchasePrice", errId: "err-purchasePrice", label: "Purchase price", type: "number", min: 0 },
    { id: "f-sellingPrice",  errId: "err-sellingPrice",  label: "Selling price",  type: "number", min: 0 },
    { id: "f-quantity",      errId: "err-quantity",      label: "Quantity",        type: "int",    min: 0 },
  ];

  fields.forEach(({ id, errId, label, type, min }) => {
    const input = document.getElementById(id);
    const val   = input.value.trim();

    if (!val) {
      setFieldError(errId, `${label} is required`);
      valid = false;
    } else if (type === "number" && (isNaN(val) || Number(val) < min)) {
      setFieldError(errId, `${label} must be ≥ ${min}`);
      valid = false;
    } else if (type === "int" && (isNaN(val) || !Number.isInteger(Number(val)) || Number(val) < min)) {
      setFieldError(errId, `${label} must be a whole number ≥ ${min}`);
      valid = false;
    }
  });

  return valid;
}

function setFieldError(errId, message) {
  const el = document.getElementById(errId);
  if (el) el.textContent = message;
  // Highlight the input
  const inputId = errId.replace("err-", "f-");
  const input   = document.getElementById(inputId);
  if (input) input.style.borderColor = "var(--red)";
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".form-group input, .form-group select").forEach((el) => {
    el.style.borderColor = "";
  });
}

// ══════════════════════════════════════════════
// LIVE PROFIT PREVIEW
// ══════════════════════════════════════════════
function updateProfitPreview() {
  const purchase = parseFloat(document.getElementById("f-purchasePrice").value) || 0;
  const selling  = parseFloat(document.getElementById("f-sellingPrice").value)  || 0;
  const qty      = parseInt(document.getElementById("f-quantity").value, 10)   || 0;

  const preview = document.getElementById("profit-preview");

  if (purchase > 0 || selling > 0) {
    const margin  = purchase > 0 ? (((selling - purchase) / purchase) * 100).toFixed(1) : 0;
    const total   = (selling * qty).toFixed(2);
    document.getElementById("profit-margin-display").textContent = `${margin}%`;
    document.getElementById("stock-value-display").textContent   = formatCurrency(total);
    preview.style.display = "flex";
  } else {
    preview.style.display = "none";
  }
}

["f-purchasePrice", "f-sellingPrice", "f-quantity"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", updateProfitPreview);
});

// ══════════════════════════════════════════════
// SEARCH & FILTER (DEBOUNCED)
// ══════════════════════════════════════════════
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");

searchInput.addEventListener("input", () => {
  searchClear.style.display = searchInput.value ? "flex" : "none";
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadProducts(), 350);
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.style.display = "none";
  loadProducts();
});

document.getElementById("category-filter").addEventListener("change", () => loadProducts());
document.getElementById("low-stock-filter").addEventListener("change", () => loadProducts());
document.getElementById("clear-search-btn").addEventListener("click", () => {
  searchInput.value = "";
  document.getElementById("category-filter").value = "all";
  document.getElementById("low-stock-filter").checked = false;
  searchClear.style.display = "none";
  loadProducts();
});

// ══════════════════════════════════════════════
// NAVIGATION EVENT LISTENERS
// ══════════════════════════════════════════════

// Sidebar nav items
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const page   = item.dataset.page;
    const filter = item.dataset.filter;
    navigateTo(page, filter ? { filter } : {});
  });
});

// General data-page navigation (excludes nav-items which are handled above)
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-page]");
  if (el && !el.classList.contains("nav-item") && (el.classList.contains("section-link") || el.classList.contains("empty-state") || el.tagName === "BUTTON")) {
    e.preventDefault();
    navigateTo(el.dataset.page);
  }
});

// Topbar "Add Product" button
document.getElementById("topbar-add-btn").addEventListener("click", () => {
  navigateTo("add-product");
});

// Form cancel button
document.getElementById("form-cancel-btn").addEventListener("click", () => {
  navigateTo("products");
});

// Close low-stock alert
document.getElementById("alert-close").addEventListener("click", () => {
  document.getElementById("low-stock-alert").style.display = "none";
});

// Mobile hamburger
document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("open");
});

// Close sidebar when overlay is tapped (mobile)
document.getElementById("sidebar-overlay").addEventListener("click", () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
});

// Close modal on backdrop click
document.getElementById("delete-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("delete-modal")) {
    document.getElementById("delete-modal").style.display = "none";
    deleteTargetId = null;
  }
});

// Logout function
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// ── Escape HTML to prevent XSS ────────────────
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, "\\'");
}

async function loadOrders() {
  const loading = document.getElementById("orders-loading");
  const wrapper = document.getElementById("orders-table-wrapper");
  const empty = document.getElementById("orders-empty");
  const tbody = document.getElementById("orders-list");

  if (!loading || !wrapper || !empty || !tbody) return;

  loading.style.display = "flex";
  wrapper.style.display = "none";
  empty.style.display   = "none";
  tbody.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/products/transactions/seller`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message);

    loading.style.display = "none";

    if (result.data.length === 0) {
      empty.style.display = "flex";
      return;
    }

    // Group transactions by productId
    const grouped = {};
    result.data.forEach((tx) => {
      const key = tx.productId || tx.productName;
      if (!grouped[key]) {
        grouped[key] = {
          productName: tx.productName,
          totalQuantity: 0,
          totalAmount: 0,
          latestDate: tx.purchaseDate,
          subOrders: [],
        };
      }
      grouped[key].totalQuantity += tx.quantity;
      grouped[key].totalAmount += tx.totalAmount;
      if (new Date(tx.purchaseDate) > new Date(grouped[key].latestDate)) {
        grouped[key].latestDate = tx.purchaseDate;
      }
      grouped[key].subOrders.push(tx);
    });

    wrapper.style.display = "block";

    Object.values(grouped).forEach((group) => {
      const row = document.createElement("tr");

      // Determine the overall status (worst-case: show most actionable)
      const statusPriority = { pending: 0, paid: 1, shipped: 2, delivered: 3 };
      const overallStatus = group.subOrders.reduce((worst, tx) => {
        return statusPriority[tx.status] < statusPriority[worst] ? tx.status : worst;
      }, 'delivered');

      const statusClass = overallStatus === 'pending' ? 'badge-amber' : 
                          overallStatus === 'paid' ? 'badge-blue' : 
                          overallStatus === 'shipped' ? 'badge-purple' : 
                          overallStatus === 'delivered' ? 'badge-green' : 'badge-outline';

      // Build action buttons for each sub-order that still needs action
      let actionsHtml = '';
      group.subOrders.forEach((tx) => {
        if (tx.status === 'pending') {
          actionsHtml += `<button class="btn btn-xs btn-primary" onclick="updateOrderStatus('${tx._id}', 'paid')" style="margin:2px 0">Confirm Payment</button>`;
        } else if (tx.status === 'paid') {
          actionsHtml += `<button class="btn btn-xs btn-purple" onclick="updateOrderStatus('${tx._id}', 'shipped')" style="margin:2px 0">Mark Shipped</button>`;
        } else if (tx.status === 'shipped') {
          actionsHtml += `<button class="btn btn-xs btn-success" onclick="updateOrderStatus('${tx._id}', 'delivered')" style="margin:2px 0">Delivered</button>`;
        }
      });

      const orderCount = group.subOrders.length;
      const idLabel = orderCount > 1 
        ? `${orderCount} orders` 
        : group.subOrders[0]._id.slice(-6).toUpperCase();

      row.innerHTML = `
        <td><span class="badge badge-outline">${idLabel}</span></td>
        <td class="font-medium">${escHtml(group.productName)}</td>
        <td>${group.totalQuantity}</td>
        <td class="font-bold">${formatCurrency(group.totalAmount)}</td>
        <td class="text-muted" style="font-size:0.85rem">${new Date(group.latestDate).toLocaleDateString()}</td>
        <td><span class="badge ${statusClass}">${overallStatus.toUpperCase()}</span></td>
        <td><div class="action-stack">${actionsHtml || '<span class="text-muted" style="font-size:0.8rem">—</span>'}</div></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    loading.style.display = "none";
    showToast(err.message, "error");
  }
}

async function updateOrderStatus(txId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/products/transactions/${txId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message);

    showToast(result.message, "success");
    loadOrders();
    // Also refresh dashboard stats if relevant
    const resStats = await fetchProducts();
    updateStats(resStats.stats);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ══════════════════════════════════════════════
// ADMIN: USERS MANAGEMENT
// ══════════════════════════════════════════════
async function loadUsers() {
  const loading = document.getElementById("users-loading");
  const wrapper = document.getElementById("users-table-wrapper");
  const empty = document.getElementById("users-empty");
  const tbody = document.getElementById("users-tbody");

  if (!loading || !wrapper || !empty || !tbody) return;

  loading.style.display = "flex";
  wrapper.style.display = "none";
  empty.style.display   = "none";
  tbody.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message);

    loading.style.display = "none";

    if (result.data.length === 0) {
      empty.style.display = "flex";
      return;
    }

    wrapper.style.display = "block";

    result.data.forEach((user) => {
      const row = document.createElement("tr");

      const roleBadge = user.role === 'seller'
        ? '<span class="badge badge-purple">SELLER</span>'
        : '<span class="badge badge-blue">BUYER</span>';

      let activityHtml = '';
      let amountHtml = '';

      if (user.role === 'seller') {
        activityHtml = `
          <div style="line-height:1.6">
            <span class="text-muted" style="font-size:0.8rem">Products:</span> <strong>${user.totalProducts}</strong><br>
            <span class="text-muted" style="font-size:0.8rem">Units Sold:</span> <strong>${user.totalUnitsSold}</strong><br>
            <span class="text-muted" style="font-size:0.8rem">Orders:</span> <strong>${user.totalOrdersReceived}</strong>
          </div>
        `;
        amountHtml = `<strong style="color:var(--green)">${formatCurrency(user.totalRevenue)}</strong>
          <br><span class="text-muted" style="font-size:0.75rem">Revenue</span>`;
      } else {
        activityHtml = `
          <div style="line-height:1.6">
            <span class="text-muted" style="font-size:0.8rem">Units Bought:</span> <strong>${user.totalUnitsBought}</strong><br>
            <span class="text-muted" style="font-size:0.8rem">Orders:</span> <strong>${user.totalOrdersMade}</strong>
          </div>
        `;
        amountHtml = `<strong style="color:var(--blue)">${formatCurrency(user.totalSpent)}</strong>
          <br><span class="text-muted" style="font-size:0.75rem">Spent</span>`;
      }

      const joinedDate = new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      row.innerHTML = `
        <td class="font-medium">${escHtml(user.username)}</td>
        <td class="text-muted">${escHtml(user.email)}</td>
        <td>${roleBadge}</td>
        <td>${activityHtml}</td>
        <td>${amountHtml}</td>
        <td class="text-muted" style="font-size:0.85rem">${joinedDate}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    loading.style.display = "none";
    showToast(err.message, "error");
  }
}

// ══════════════════════════════════════════════
// INIT: Load dashboard on page load
// ══════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  console.log(`[INIT] Logged in as: ${USER.username} (${USER.role})`);
  
  // Verify backend version
  try {
    const healthRes = await fetch("/api/health");
    const healthData = await healthRes.json();
    console.log(`[BACKEND] Version: ${healthData.version}`);
    if (healthData.version !== "2.1.0-with-transactions") {
      showToast("Backend outdated. Please restart server.", "warning");
    }
  } catch (err) {
    console.warn("[BACKEND] Health check failed - might be old version");
  }
  
  // Update UI for roles
  if (USER.role === "admin" || USER.role === "seller") {
    const topbarActions = document.getElementById("topbar-actions");
    const sidebarAddBtn = document.getElementById("sidebar-add-btn");
    const seedBtn = document.getElementById("seed-btn");

    if (topbarActions) topbarActions.style.display = "block";
    if (sidebarAddBtn) sidebarAddBtn.style.display = "flex";
    if (seedBtn) seedBtn.style.display = (USER.role === "admin") ? "flex" : "none";
  } else {
    const sidebarAddBtn = document.getElementById("sidebar-add-btn");
    const seedBtn = document.getElementById("seed-btn");
    if (sidebarAddBtn) sidebarAddBtn.style.display = "none";
    if (seedBtn) seedBtn.style.display = "none";
  }

  if (USER.role === "buyer") {
    // Buyers don't see dashboard or low stock summaries
    const dashboardNavItem = document.querySelector('.nav-item[data-page="dashboard"]');
    const lowStockNavItem = document.getElementById("low-stock-nav");
    if (dashboardNavItem) dashboardNavItem.style.display = "none";
    if (lowStockNavItem) lowStockNavItem.style.display = "none";
    
    // Show purchases history for buyers
    const purchasesNavItem = document.getElementById("sidebar-purchases");
    if (purchasesNavItem) purchasesNavItem.style.display = "flex";

    // Setup "My Products" as "My Purchases" for buyers
    const myProductsBtn = document.getElementById("sidebar-my-products");
    if (myProductsBtn) {
      myProductsBtn.style.display = "flex";
      myProductsBtn.dataset.page = "purchases";
      myProductsBtn.querySelector("span").textContent = "My Purchases";
      myProductsBtn.querySelector("i").className = "ph-bold ph-shopping-bag";
    }
    
    // Hide the actual (now duplicate) purchases button
    if (purchasesNavItem) purchasesNavItem.style.display = "none";

    // Redirect landing page
    navigateTo("products");
  } else if (USER.role === "seller") {
    // Default for Seller
    const myProductsBtn = document.getElementById("sidebar-my-products");
    if (myProductsBtn) {
       myProductsBtn.style.display = "flex";
       myProductsBtn.onclick = () => {
         // Apply myProducts filter manually
         navigateTo("products", { filter: "myProducts" });
       };
    }
    
    const ordersBtn = document.getElementById("sidebar-orders");
    if (ordersBtn) ordersBtn.style.display = "flex";

    navigateTo("dashboard");
  } else {
    // Admin
    const usersBtn = document.getElementById("sidebar-users");
    if (usersBtn) usersBtn.style.display = "flex";

    navigateTo("dashboard");
  }
});
