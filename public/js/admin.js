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
              Number(product.discount || 0) > 0
                ? "₹" + (
                    Number(product.sale_price || 0) > 0 &&
                    Number(product.sale_price) < Number(product.price || 0)
                      ? Number(product.sale_price)
                      : Number(product.price || 0) *
                        (1 - Number(product.discount) / 100)
                  ).toFixed(2) +
                  " (was ₹" + Number(product.price || 0) + ")" +
                  " • 🔥 " + Number(product.discount) + "% OFF"
                : (
                    Number(product.sale_price || 0) > 0 &&
                    Number(product.sale_price) < Number(product.price || 0)
                      ? "₹" + Number(product.sale_price) +
                        " (was ₹" + Number(product.price || 0) + ")"
                      : (
                          product.price
                            ? "₹" + product.price
                            : "Price on request"
                        )
                  )
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
      "sale_price",
      "discount",
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
    sale_price: Number(product.sale_price || 0),
    discount: Number(product.discount || 0),
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

async function uploadProductImage(file) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Please valid image select karein");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image maximum 5MB ki ho sakti hai");
  }

  const formData = new FormData();
  formData.append("image", file);

  const headers = {};

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(
    "/api/admin/upload-product-image",
    {
      method: "POST",
      headers,
      body: formData
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "Image upload failed"
    );
  }

  return data.image_url || "";
}

async function saveProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  try {
    const imageFile = $("productImageFile")?.files?.[0];

    let imageUrl =
      String(formData.get("image_url") || "").trim();

    if (imageFile) {
      toast("Image upload ho rahi hai... ⬆️");

      imageUrl = await uploadProductImage(imageFile);

      if (form.elements.image_url) {
        form.elements.image_url.value = imageUrl;
      }

      toast("Image upload successful ✓");
    }

    const product = {
      name: formData.get("name"),
      category: formData.get("category"),
      price: Number(formData.get("price")) || 0,
      sale_price: Number(formData.get("sale_price")) || 0,
      discount: Math.min(
        100,
        Math.max(0, Number(formData.get("discount")) || 0)
      ),
      unit: formData.get("unit") || "",
      description: formData.get("description") || "",
      image_url: imageUrl,
      stock: Number(formData.get("stock")) || 0,
      available: form.elements.available
        ? form.elements.available.checked
        : true
    };

    const id = formData.get("id");

    if (id) {
      await api(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(product)
      });

      toast("Product + image updated online ✓");

    } else {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify(product)
      });

      toast("Product + image added online ✓");
    }

    $("modal")?.classList.add("hidden");

    if ($("productImageFile")) {
      $("productImageFile").value = "";
    }

    if ($("productImagePreview")) {
      $("productImagePreview").classList.add("hidden");
    }

    if ($("productPreviewImg")) {
      $("productPreviewImg").src = "";
    }

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


/* ===== INVENTORY ANALYTICS ===== */

function updateInventoryAnalytics() {
  const products = Array.isArray(adminProducts) ? adminProducts : [];

  let totalValue = 0;
  let totalStockUnits = 0;
  let stockedProducts = 0;
  let pricedProducts = 0;
  let priceSum = 0;

  products.forEach((product) => {
    const price = Number(product.price || 0);
    const stock = Math.max(0, Number(product.stock || 0));

    totalValue += price * stock;
    totalStockUnits += stock;

    if (stock > 0 && product.available !== false) {
      stockedProducts++;
    }

    if (price > 0) {
      pricedProducts++;
      priceSum += price;
    }
  });

  const averagePrice =
    pricedProducts > 0
      ? priceSum / pricedProducts
      : 0;

  const valueEl = $("analyticsTotalValue");
  const stockEl = $("analyticsStockUnits");
  const avgEl = $("analyticsAvgPrice");
  const stockedEl = $("analyticsStockedProducts");

  if (valueEl) {
    valueEl.textContent =
      "₹" + Math.round(totalValue).toLocaleString("en-IN");
  }

  if (stockEl) {
    stockEl.textContent =
      totalStockUnits.toLocaleString("en-IN");
  }

  if (avgEl) {
    avgEl.textContent =
      "₹" + Math.round(averagePrice).toLocaleString("en-IN");
  }

  if (stockedEl) {
    stockedEl.textContent =
      stockedProducts.toLocaleString("en-IN");
  }
}

/* Keep analytics synced with inventory */
const originalUpdateInventoryStats =
  updateInventoryStats;

updateInventoryStats = function () {
  originalUpdateInventoryStats();
  updateInventoryAnalytics();
};


/* ===== LIVE SHOP PREVIEW ===== */

function updateShopLivePreview() {
  const form = $("shopForm");
  if (!form) return;

  const get = (name) =>
    form.elements[name]?.value?.trim() || "";

  const name = get("name") || "Himanshu Hardware";
  const tagline =
    get("tagline") ||
    "Quality Hardware • Trusted Service";

  const phone = get("phone");
  const whatsapp = get("whatsapp");
  const openTime = get("open_time") || "7:00 AM";
  const closeTime = get("close_time") || "9:00 PM";
  const address = get("address");
  const description =
    get("description") ||
    "Hardware, construction items, paint accessories...";

  const status = get("shop_status") || "open";
  const logo = get("logo_url");
  const cover = get("cover_url");

  const nameEl = $("previewName");
  const taglineEl = $("previewTagline");
  const phoneEl = $("previewPhone");
  const whatsappEl = $("previewWhatsApp");
  const hoursEl = $("previewHours");
  const addressEl = $("previewAddress");
  const descriptionEl = $("previewDescription");
  const statusEl = $("previewStatus");
  const logoEl = $("previewLogo");
  const coverEl = document.querySelector(".preview-cover");

  if (nameEl) nameEl.textContent = name;
  if (taglineEl) taglineEl.textContent = tagline;

  if (phoneEl) {
    phoneEl.textContent =
      phone ? `📞 ${phone}` : "📞 Phone not set";
  }

  if (whatsappEl) {
    whatsappEl.textContent =
      whatsapp ? `💬 WhatsApp ${whatsapp}` : "💬 WhatsApp not set";
  }

  if (hoursEl) {
    hoursEl.textContent =
      `🕐 ${openTime} – ${closeTime}`;
  }

  if (addressEl) {
    addressEl.textContent =
      address ? `📍 ${address}` : "📍 Shop address not set";
  }

  if (descriptionEl) {
    descriptionEl.textContent = description;
  }

  if (statusEl) {
    statusEl.className =
      `preview-status ${status}`;

    const statusText = {
      open: "🟢 Open",
      closed: "🔴 Closed",
      temporary: "🟡 Temporarily Closed"
    };

    statusEl.textContent =
      statusText[status] || "🟢 Open";
  }

  if (logoEl) {
    if (logo) {
      logoEl.innerHTML =
        `<img src="${esc(logo)}" alt="Shop Logo">`;
    } else {
      logoEl.textContent = "HH";
    }
  }

  if (coverEl) {
    if (cover) {
      coverEl.style.backgroundImage =
        `linear-gradient(#0005,#0005),url("${cover.replace(/"/g, '\\"')}")`;
    } else {
      coverEl.style.backgroundImage =
        "linear-gradient(135deg,#182b43,#0b1220)";
    }
  }
}

/* Update preview whenever any Shop field changes */

$("shopForm")?.addEventListener("input", updateShopLivePreview);
$("shopForm")?.addEventListener("change", updateShopLivePreview);

/* Initial preview */

setTimeout(updateShopLivePreview, 100);


/* ===== QUICK ACTIONS ===== */

document.querySelectorAll(".quick-action").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "add-product") {
      openModal();
      return;
    }

    if (action === "inventory") {
      $("inventory")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      if ($("productSearch")) {
        $("productSearch").value = "";
      }

      if ($("productFilter")) {
        $("productFilter").value = "all";
      }

      renderProducts();
      return;
    }

    if (action === "low-stock") {
      $("inventory")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      if ($("productSearch")) {
        $("productSearch").value = "";
      }

      if ($("productFilter")) {
        $("productFilter").value = "low";
      }

      renderProducts();
      return;
    }

    if (action === "out-stock") {
      $("inventory")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      if ($("productSearch")) {
        $("productSearch").value = "";
      }

      if ($("productFilter")) {
        $("productFilter").value = "out";
      }

      renderProducts();
      return;
    }

    if (action === "shop") {
      document.querySelector('[data-tab="shop"]')?.click();

      $("shop")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
});


/* ===== PRODUCT IMAGE UPLOAD PREVIEW ===== */

$("productImageFile")?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  const previewBox = $("productImagePreview");
  const previewImg = $("productPreviewImg");

  if (!file || !previewBox || !previewImg) return;

  if (!file.type.startsWith("image/")) {
    toast("Please image file select karein");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    previewImg.src = reader.result;
    previewBox.classList.remove("hidden");
  };

  reader.readAsDataURL(file);
});

