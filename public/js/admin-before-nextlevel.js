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

    renderProducts();

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

function renderProducts() {
  const container = $("adminProducts");

  if (!container) return;

  container.innerHTML =
    adminProducts.map((product) => `
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
            ${esc(product.category)}
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
          </small>
        </div>

        <div>
          <button
            type="button"
            onclick="editProduct('${product.id}')">
            ✏️
          </button>

          <button
            type="button"
            onclick="deleteProduct('${product.id}')">
            🗑️
          </button>
        </div>

      </div>
    `).join("") || "<p>No products.</p>";
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

/* ================= EVENTS ================= */

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
