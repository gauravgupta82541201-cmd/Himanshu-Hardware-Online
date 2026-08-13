const API = "/api";

let shop = {};
let products = [];
let cart = [];

const $ = id => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

async function getJSON(url, opts = {}) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

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
  }, 1800);
}


/* =========================
   LOAD PUBLIC DATA
========================= */

async function loadPublic() {
  try {
    const result = await Promise.all([
      getJSON(API + "/shop"),
      getJSON(API + "/products")
    ]);

    shop = result[0] || {};
    products = Array.isArray(result[1]) ? result[1] : [];

    applyShop();
    renderProducts();

  } catch (e) {
    console.error("Public data error:", e);
    toast("Server/database connect nahi hua");
  }
}


/* =========================
   SHOP DATA
========================= */

function applyShop() {

  /* Shop name */
  document
    .querySelectorAll("[data-shop-name]")
    .forEach(el => {
      el.textContent = shop.name || "Himanshu Hardware";
    });


  /* Shop description */
  document
    .querySelectorAll("[data-shop-description]")
    .forEach(el => {
      el.textContent =
        shop.description ||
        "Hardware, construction items, paint accessories, plywood aur daily repair needs — sab ek jagah.";
    });


  /* Phone */
  document
    .querySelectorAll("[data-shop-phone]")
    .forEach(el => {
      const phone = shop.phone || "6200908356";

      el.textContent = phone;

      if (el.tagName === "A") {
        el.href = "tel:+91" + phone.replace(/\D/g, "");
      }
    });


  /* Address */
  document
    .querySelectorAll("[data-shop-address]")
    .forEach(el => {
      el.textContent = shop.address || "";
    });


  /* WhatsApp */
  const whatsapp = shop.whatsapp || shop.phone;

  if (whatsapp) {
    const waNumber = whatsapp.replace(/\D/g, "");

    document
      .querySelectorAll("[data-wa]")
      .forEach(el => {
        el.href = "https://wa.me/91" + waNumber;
        el.target = "_blank";
      });
  }


  /* Google Maps */
  document
    .querySelectorAll("[data-maps]")
    .forEach(el => {
      if (shop.maps_url) {
        el.href = shop.maps_url;
        el.target = "_blank";
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });


  /* =========================
     LOGO
  ========================= */

  document
    .querySelectorAll("[data-logo]")
    .forEach(el => {

      if (shop.logo_url) {

        el.innerHTML = `
          <img
            src="${esc(shop.logo_url)}"
            alt="${esc(shop.name || "Himanshu Hardware")} Logo"
            onerror="this.style.display='none';this.parentElement.textContent='HH';"
          >
        `;

      } else {

        el.textContent = "HH";

      }
    });


  /* =========================
     SOCIAL LINKS
  ========================= */

  const socialConfig = [
    {
      key: "instagram_url",
      name: "Instagram",
      icon: "📸"
    },
    {
      key: "facebook_url",
      name: "Facebook",
      icon: "📘"
    },
    {
      key: "youtube_url",
      name: "YouTube",
      icon: "▶️"
    },
    {
      key: "website_url",
      name: "Website",
      icon: "🌐"
    }
  ];


  socialConfig.forEach(item => {

    document
      .querySelectorAll(`[data-social="${item.name}"]`)
      .forEach(el => {

        const url = String(shop[item.key] || "").trim();

        if (url) {

          el.href = url;
          el.target = "_blank";
          el.rel = "noopener noreferrer";

          /* Force visible */
          el.classList.remove("hidden");

          el.style.display = "inline-flex";

          /* Keep professional HTML icons — do not replace them with emoji */
          if (!el.dataset.iconAdded) {
            const icon = el.querySelector(".social-icon");

            if (icon) {
              el.dataset.iconAdded = "1";
            } else {
              el.innerHTML = `<span class="social-icon ${item.name.toLowerCase()}-icon">${item.name === "Instagram" ? '<span class="instagram-camera"></span>' : item.icon}</span><span>${item.name}</span>`;
              el.dataset.iconAdded = "1";
            }
          }

        } else {

          el.classList.add("hidden");
          el.style.display = "none";

        }
      });
  });


  /* =========================
     OPENING / CLOSING TIME
  ========================= */

  document
    .querySelectorAll("[data-shop-open]")
    .forEach(el => {
      el.textContent = shop.open_time || "7:00 AM";
    });

  document
    .querySelectorAll("[data-shop-close]")
    .forEach(el => {
      el.textContent = shop.close_time || "9:00 PM";
    });


  /* =========================
     GOOGLE RATING
  ========================= */

  document
    .querySelectorAll("[data-google-rating]")
    .forEach(el => {
      el.textContent =
        (shop.google_rating || "5.0") + " ⭐";
    });


  console.log("Shop loaded:", shop);
}


/* =========================
   PRODUCTS
========================= */

function renderProducts() {

  const box = $("products");

  if (!box) return;

  const q =
    ($("search")?.value || "")
      .toLowerCase()
      .trim();

  const cat =
    $("category")?.value || "all";


  const cats = [
    ...new Set(
      products
        .map(p => p.category)
        .filter(Boolean)
    )
  ].sort();


  if ($("category")) {

    const current = $("category").value;

    $("category").innerHTML =
      '<option value="all">All Categories</option>' +
      cats
        .map(c => `<option value="${esc(c)}">${esc(c)}</option>`)
        .join("");

    if (
      current &&
      cats.includes(current)
    ) {
      $("category").value = current;
    }
  }


  const list = products.filter(p => {

    const text =
      `${p.name || ""} ${p.category || ""} ${p.description || ""}`
        .toLowerCase();

    return (
      (cat === "all" || p.category === cat) &&
      text.includes(q)
    );
  });


  box.innerHTML = list
    .map(p => `

      <article class="product">

        <div class="pic">

          ${
            p.image_url
              ? `
                <img
                  src="${esc(p.image_url)}"
                  alt="${esc(p.name)}"
                  loading="lazy"
                  onerror="this.style.display='none';this.parentElement.textContent='🔨';"
                >
              `
              : "🔨"
          }

        </div>

        <div class="pbody">

          <small>${esc(p.category)}</small>

          <h3>${esc(p.name)}</h3>

          <p>${esc(p.description)}</p>

          <div class="price">

            ${
              p.price
                ? "₹" + Number(p.price).toLocaleString("en-IN")
                : "Price on request"
            }

            <span>${esc(p.unit)}</span>

          </div>

          ${
            p.available
              ? `
                <button
                  type="button"
                  class="btn primary"
                  onclick="addToCart('${p.id}')"
                >
                  ＋ Add to List
                </button>
              `
              : `
                <span class="status">
                  Currently unavailable
                </span>
              `
          }

        </div>

      </article>

    `)
    .join("") || "<p>No products found.</p>";


  renderCart();
}


/* =========================
   CART
========================= */

function addToCart(id) {

  const existing = cart.find(x => x.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id,
      qty: 1
    });
  }

  renderCart();
  toast("Product added ✓");
}


function changeQty(id, amount) {

  const item = cart.find(x => x.id === id);

  if (!item) return;

  item.qty += amount;

  if (item.qty < 1) {
    cart = cart.filter(x => x.id !== id);
  }

  renderCart();
}


function renderCart() {

  const box = $("cartItems");

  if (!box) return;

  let total = 0;


  box.innerHTML = cart
    .map(item => {

      const product =
        products.find(p => p.id === item.id);

      if (!product) return "";

      total +=
        (Number(product.price) || 0) *
        item.qty;


      return `
        <div class="cartrow">

          <b>${esc(product.name)}</b>

          <span>

            <button
              type="button"
              onclick="changeQty('${product.id}', -1)"
            >
              −
            </button>

            ${item.qty}

            <button
              type="button"
              onclick="changeQty('${product.id}', 1)"
            >
              +
            </button>

          </span>

        </div>
      `;
    })
    .join("") ||
    "<p>Your list is empty.</p>";


  if ($("total")) {
    $("total").textContent =
      "₹" + total.toLocaleString("en-IN");
  }
}


/* =========================
   SEARCH / FILTER
========================= */

$("search")?.addEventListener(
  "input",
  renderProducts
);


$("category")?.addEventListener(
  "change",
  renderProducts
);


/* =========================
   CLEAR CART
========================= */

$("clear")?.addEventListener(
  "click",
  () => {

    cart = [];

    renderCart();

    toast("List cleared");
  }
);


/* =========================
   WHATSAPP ORDER
========================= */

$("whatsapp")?.addEventListener(
  "click",
  () => {

    if (!cart.length) {
      toast("Cart empty hai");
      return;
    }


    const number =
      (shop.whatsapp || shop.phone || "")
        .replace(/\D/g, "");


    if (!number) {
      toast("WhatsApp number available nahi hai");
      return;
    }


    const lines = cart
      .map(item => {

        const p =
          products.find(x => x.id === item.id);

        return p
          ? `• ${p.name} — Qty: ${item.qty}`
          : "";
      })
      .filter(Boolean)
      .join("\n");


    const message =
      `Namaste Himanshu Hardware,\n\n` +
      `${lines}\n\n` +
      `Please confirm availability and price.`;


    window.open(
      `https://wa.me/91${number}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }
);


/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  loadPublic
);
