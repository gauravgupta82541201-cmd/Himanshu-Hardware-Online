import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { db } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const productUploadDir = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "products"
);

const productStorage = multer.memoryStorage();


const logoUploadDir = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "logo"
);

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logoUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `logo-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${ext}`;

    cb(null, safeName);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  }
});

const productUpload = multer({
  storage: productStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  }
});


app.post(
  "/api/admin/upload-product-image",
  auth,
  productUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Image file required"
        });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const fileName = `product-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}${ext}`;

      const uploadResponse = await fetch(
        `${process.env.SUPABASE_URL}/storage/v1/object/products/${encodeURIComponent(fileName)}`,
        {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": req.file.mimetype,
            "x-upsert": "true"
          },
          body: req.file.buffer
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Supabase upload failed: ${errorText}`);
      }

      const imageUrl =
        `${process.env.SUPABASE_URL}/storage/v1/object/public/products/${encodeURIComponent(fileName)}`;

      res.json({
        ok: true,
        image_url: imageUrl,
        filename: fileName
      });
    } catch (e) {
      console.error("IMAGE UPLOAD ERROR:", e);

      res.status(500).json({
        error: e.message || "Image upload failed"
      });
    }
  }
);


app.post(
  "/api/admin/upload-logo",
  auth,
  logoUpload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Logo image required"
        });
      }

      const logoUrl = `/uploads/logo/${req.file.filename}`;

      res.json({
        ok: true,
        logo_url: logoUrl,
        filename: req.file.filename
      });
    } catch (e) {
      console.error("LOGO UPLOAD ERROR:", e);

      res.status(500).json({
        error: e.message || "Logo upload failed"
      });
    }
  }
);

function normalizeProduct(body = {}) {
  return {
    name: String(body.name || "").trim(),
    category: String(body.category || "").trim(),
    price: Number(body.price) || 0,
    sale_price: Number(body.sale_price) || 0,
    discount: Math.min(
      100,
      Math.max(0, Number(body.discount) || 0)
    ),
    unit: String(body.unit || "").trim(),
    description: String(body.description || "").trim(),
    image_url: String(body.image_url || "").trim(),
    available: body.available !== false,
    stock: Number(body.stock) || 0
  };
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Session expired. Login again."
    });
  }
}

/* ---------------- HEALTH ---------------- */

app.get("/api/health", async (_req, res) => {
  try {
    await db.getSettings();

    res.json({
      ok: true,
      database: "online"
    });
  } catch (e) {
    res.status(503).json({
      ok: false,
      database: "offline",
      error: e.message
    });
  }
});

/* ---------------- SHOP ---------------- */

app.get("/api/shop", async (_req, res) => {
  try {
    const rows = await db.getSettings();

    res.json(rows[0] || {});
  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- PRODUCTS PUBLIC ---------------- */

app.get("/api/products", async (_req, res) => {
  try {
    res.json(await db.listProducts());
  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- ADMIN LOGIN ---------------- */

app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required"
      });
    }

    const cleanEmail = String(email)
      .toLowerCase()
      .trim();

    const cleanPassword = String(password);

    const rows = await db.findAdmin(cleanEmail);
    const admin = rows[0];

    const passwordMatch = admin
      ? await bcrypt.compare(
          cleanPassword,
          admin.password_hash
        )
      : false;

    /*
      Safe diagnostic:
      Password itself is NEVER printed.
    */
    console.log("LOGIN DEBUG:", {
      emailReceived: cleanEmail,
      adminFound: !!admin,
      passwordReceived: typeof cleanPassword === "string",
      passwordLength: cleanPassword.length,
      passwordMatch
    });

    if (!admin || !passwordMatch) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email
      },
      JWT_SECRET,
      {
        expiresIn: "8h"
      }
    );

    console.log("ADMIN LOGIN SUCCESS:", admin.email);

    res.json({
      token,
      admin: {
        email: admin.email
      }
    });

  } catch (e) {
    console.error("LOGIN ERROR:", e);

    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- ADD PRODUCT ---------------- */

app.post("/api/products", auth, async (req, res) => {
  try {
    const product = normalizeProduct(req.body);

    if (!product.name || !product.category) {
      return res.status(400).json({
        error: "Product name and category are required"
      });
    }

    const result = await db.createProduct(product);

    res.status(201).json(
      Array.isArray(result) ? result[0] : result
    );

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- UPDATE PRODUCT ---------------- */

app.patch("/api/products/:id", auth, async (req, res) => {
  try {
    const product = normalizeProduct(req.body);

    const result = await db.updateProduct(
      req.params.id,
      product
    );

    res.json(
      Array.isArray(result) ? result[0] : result
    );

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- DELETE PRODUCT ---------------- */

app.delete("/api/products/:id", auth, async (req, res) => {
  try {
    await db.deleteProduct(req.params.id);

    res.json({
      ok: true
    });

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- UPDATE SHOP ---------------- */

app.patch("/api/shop", auth, async (req, res) => {
  try {
    const allowed = [
      "name",
      "phone",
      "whatsapp",
      "address",
      "maps_url",
      "logo_url",
      "cover_url",
      "instagram_url",
      "facebook_url",
      "youtube_url",
      "website_url",
      "open_time",
      "close_time",
      "google_rating",
      "description"
    ];

    const update = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = String(req.body[key]);
      }
    }

    const result = await db.updateSettings(update);

    res.json(
      Array.isArray(result) ? result[0] : result
    );

  } catch (e) {
    res.status(500).json({
      error: e.message
    });
  }
});

/* ---------------- SPA FALLBACK ---------------- */

app.get("/{*splat}", (_req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "..",
      "public",
      "index.html"
    )
  );
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(
    `Himanshu Hardware server running at http://127.0.0.1:${PORT}`
  );
});
