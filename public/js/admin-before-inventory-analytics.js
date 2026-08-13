let token = localStorage.getItem("hh_admin_token");
let adminProducts = [];

const $ = (id) => document.getElementById(id);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));

function toast(message) {
  let t = $("toast");

  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }

  t.textContent = message;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2200);
}

async function api(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/* ================= LOGIN ================= */

async function login() {
  try {
    const email = $("email")?.value.trim();
    const password = $("password")?.value || "";

    if (!email || !password) {
      toast("Email aur password required");
      return;
    }

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    token = data.token;

    localStorage.setItem("hh_admin_token", token);

    showDash();

    toast("Login successful ✓");

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    toast(error.message);
  }
}

/* ================= DASHBOARD ================= */

function showDash() {
  $("loginBox")?.classList.add("hidden");
  $("dashboard")?.classList.remove("hidden");

  loadAdmin();
}

async function loadAdmin() {
  try {
    adminProducts = await api("/api/products");

    refreshInventory();

    const response = await fetch("/api/shop");
    const settings = await response.json();

    if (!response.ok) {
      throw new Error(settings.error || "Shop settings load failed");
    }

    fillShopForm(settings);

  } catch (error) {
    console.error("LOAD ADMIN ERROR:", error);

    if (error.message.includes("Login") ||
        error.message.includes("Session")) {
      localStorage.removeItem("hh_admin_token");
      token = null;

      $("dashboard")?.classList.add("hidden");
      $("loginBox")?.classList.remove("hidden");
    }

    toast(error.message);
  }
}

/* ================= SHOP SETTINGS ================= */

function fillShopForm(settings) {
  if (!settings) return;

  Object.entries(settings).forEach(([key, value]) => {
    const field = document.querySelector(`[name="${key}"]`);

    if (!field) return;

    if (field.type === "checkbox") {
      field.checked =
        value === true ||
        value === "true" ||
        value === "on";
    } else {
      field.value = value ?? "";
    }
  });
}

async function saveShopSettings(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const settings = {};

  for (const [key, value] of formData.entries()) {
    settings[key] = String(value);
  }

  /* Handle checkboxes that are unchecked */
  form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    settings[checkbox.name] = checkbox.checked;
  });

  try {
    await api("/api/shop", {
      method: "PATCH",
      body: JSON.stringify(settings)
    });

    toast("Shop settings saved online ✓");

  } catch (error) {
    console.error("SHOP SAVE ERROR:", error);
    toast(error.message);
  }
}

/* ================= PRODUCTS ================= */

function updateInventoryStats() {
  const total = adminProducts.length;
  const available = adminProducts.filter(p => p.available !== false).length;
  const unavailable = adminProducts.filter(p => p.available === false).length;
  const lowStock = adminProducts.filter(p =>
    p.available !== false &&
    Number(p.stock || 0) > 0 &&
    Number(p.stock || 0) <= 5
  ).length;

  const totalEl = $("statTotal");
  const availableEl = $("statAvailable");
  const lowEl = $("statLowStock");
  const unavailableEl = $("statUnavailable");

  if (totalEl) totalEl.textContent = total;
  if (availableEl) availableEl.textContent = available;
  if (lowEl) lowEl.textContent = lowStock;
  if (unavailableEl) unavailableEl.textContent = unavailable;
}

function populateInventoryCategories() {
  const select = $("inventoryCategory");
  if (!select) return;

  const current = select.value;

  const categories = [...new Set(
    adminProducts
      .map(p => String(p.category || "").trim())
      .filter(Boolean)
  )].sort();

  select.innerHTML =
    '<option value="">All Categories</option>' +
    categories.map(category =>
      `<option value="${esc(category)}">${esc(category)}</option>`
    ).join("");

  if (categories.includes(current)) {
    select.value = current;
  }
}

function getFilteredProducts() {
  const search = ($("productSearch")?.value || "")
    .trim()
    .toLowerCase();

  const filter = $("productFilter")?.value || "all";

  return adminProducts.filter(product => {
    const searchable = [
      product.name,
      product.category,
      product.description,
      product.unit
    ]
      .map(value => String(value || "").toLowerCase())
      .join(" ");

    if (search && !searchable.includes(search)) {
      return false;
    }

    const stock = Number(product.stock || 0);

    if (filter === "available") {
      return product.available !== false && stock > 0;
    }

    if (filter === "low") {
      return product.available !== false && stock > 0 && stock <= 5;
    }

    if (filter === "out") {
      return stock <= 0 || product.available === false;
    }

    if (filter === "featured") {
      return product.featured === true;
    }

    if (filter === "offer") {
      return Number(product.discount || 0) > 0 ||
             Number(product.sale_price || 0) > 0;
    }

    return true;
  });
}

function refreshInventory() {
  updateInventoryStats();
  populateInventoryCategories();
  renderProducts();
}

function renderProducts() {
  const container = $("adminProducts");

  if (!container) return;

  const products = getFilteredProducts();

  container.innerHTML =
    products.map((product) => `
      <div class="adminrow">

        <div class="thumb">
          ${
            product.image_url
              ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}">`
              : "🔨"
          }
        </div>

        <div>
          <b>${esc(product.name)}</b>

          <small>
            ${esc(product.category || "General")}
            •
            ${
              product.price
                ? "₹" + product.price
                : "Price on request"
            }
            •
            ${
              product.available
                ? "Available"
                : "Unavailable"
            }
            • Stock: ${Number(product.stock || 0)}
          </small>
        </div>

        <div class="inventory-actions">
          <div class="quick-stock">
            <button
              type="button"
              title="Stock decrease"
              onclick="quickStock('${product.id}', -1)">
              −
            </button>

            <strong>${Number(product.stock || 0)}</strong>

            <button
              type="button"
              title="Stock increase"
              onclick="quickStock('${product.id}', 1)">
              +
            </button>
          </div>

          <button
            type="button"
            title="Edit product"
            onclick="editProduct('${product.id}')">
            ✏️
          </button>

          <button
            type="button"
            title="Delete product"
            onclick="deleteProduct('${product.id}')">
            🗑️
          </button>
        </div>

      </div>
    `).join("") ||
    `<p style="padding:20px;color:#64748b">
      🔎 Koi product nahi mila.
    </p>`;
}


function openModal(product = null) {
  const modal = $("modal");
  const form = $("productForm");

  if (!modal || !form) return;

  modal.classList.remove("hidden");

  if ($("modalTitle")) {
    $("modalTitle").textContent =
      product ? "Edit Product" : "Add Product";
  }

  form.reset();

  if (form.elements.id) {
    form.elements.id.value = product?.id || "";
  }

  if (product) {
    const fields = [
      "name",
      "category",
      "price",
      "unit",
      "description",
      "image_url",
      "stock"
    ];

    fields.forEach((key) => {
      if (form.elements[key]) {
        form.elements[key].value =
          product[key] ?? "";
      }
    });

    if (form.elements.available) {
      form.elements.available.checked =
        product.available !== false;
    }
  }
}

async function quickStock(id, change) {
  const product = adminProducts.find((item) => item.id === id);

  if (!product) {
    toast("Product nahi mila");
    return;
  }

  const currentStock = Number(product.stock || 0);
  const newStock = Math.max(0, currentStock + Number(change || 0));

  if (newStock === currentStock) {
    toast("Stock already 0");
    return;
  }

  const updatedProduct = {
    name: product.name || "",
    category: product.category || "",
    price: Number(product.price || 0),
    unit: product.unit || "",
    description: product.description || "",
    image_url: product.image_url || "",
    stock: newStock,
    available: product.available !== false
  };

  try {
    await api(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updatedProduct)
    });

    product.stock = newStock;

    toast(
      change > 0
        ? `Stock +1 → ${newStock} ✓`
        : `Stock -1 → ${newStock} ✓`
    );

    refreshInventory();
  } catch (error) {
    console.error("QUICK STOCK ERROR:", error);
    toast(error.message);
  }
}

function editProduct(id) {
  const product =
    adminProducts.find((item) => item.id === id);

  if (product) {
    openModal(product);
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete product?")) return;

  try {
    await api(`/api/products/${id}`, {
      method: "DELETE"
    });

    toast("Product deleted ✓");

    await loadAdmin();

  } catch (error) {
    console.error("DELETE ERROR:", error);
    toast(error.message);
  }
}

/* ================= PRODUCT FORM ================= */

async function saveProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const product = {
    name: formData.get("name"),
    category: formData.get("category"),
    price: Number(formData.get("price")) || 0,
    unit: formData.get("unit") || "",
    description: formData.get("description") || "",
    image_url: formData.get("image_url") || "",
    stock: Number(formData.get("stock")) || 0,
    available: form.elements.available
      ? form.elements.available.checked
      : true
  };

  try {
    const id = formData.get("id");

    if (id) {
      await api(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(product)
      });

      toast("Product updated online ✓");

    } else {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify(product)
      });

      toast("Product added online ✓");
    }

    $("modal")?.classList.add("hidden");

    await loadAdmin();

  } catch (error) {
    console.error("PRODUCT SAVE ERROR:", error);
    toast(error.message);
  }
}

/* ================= INVENTORY FILTER EVENTS ================= */

$("inventorySearch")?.addEventListener("input", renderProducts);

$("inventoryCategory")?.addEventListener(
  "change",
  renderProducts
);

$("inventoryAvailability")?.addEventListener(
  "change",
  renderProducts
);

/* ================= EVENTS ================= */

$("productSearch")?.addEventListener("input", renderProducts);

$("productFilter")?.addEventListener("change", renderProducts);

$("login")?.addEventListener("click", login);

$("password")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    login();
  }
});

$("add")?.addEventListener("click", () => {
  openModal();
});

$("close")?.addEventListener("click", () => {
  $("modal")?.classList.add("hidden");
});

$("productForm")?.addEventListener(
  "submit",
  saveProduct
);

$("shopForm")?.addEventListener(
  "submit",
  saveShopSettings
);

$("logout")?.addEventListener("click", () => {
  localStorage.removeItem("hh_admin_token");

  token = null;

  location.reload();
});

/* ================= AUTO LOGIN ================= */

if (token) {
  showDash();
}

