import bcrypt from "bcryptjs";
import { db } from "./supabase.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function base64url(input) {
  const bytes =
    input instanceof Uint8Array
      ? input
      : new TextEncoder().encode(input);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(value) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((value.length + 3) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function signJwt(payload, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  const data =
    `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );

  return `${data}.${base64url(
    new Uint8Array(signature)
  )}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token");
  }

  const [header, payload, signature] = parts;

  const data = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(signature),
    new TextEncoder().encode(data)
  );

  if (!valid) {
    throw new Error("Invalid token");
  }

  const decoded = JSON.parse(
    new TextDecoder().decode(
      base64urlDecode(payload)
    )
  );

  if (
    !decoded.exp ||
    Date.now() / 1000 > decoded.exp
  ) {
    throw new Error("Session expired");
  }

  return decoded;
}

async function requireAuth(request, env) {
  const authorization =
    request.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Login required");
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    throw new Error("Login required");
  }

  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  return verifyJwt(token, env.JWT_SECRET);
}

function normalizeProduct(body) {
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
    stock: Math.max(0, Number(body.stock) || 0),
    available: body.available !== false
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {

      /* ================= HEALTH ================= */

      if (
        request.method === "GET" &&
        url.pathname === "/api/health"
      ) {
        await db.getSettings(env);

        return json({
          ok: true,
          database: "online",
          runtime: "cloudflare-worker"
        });
      }


      /* ================= SHOP ================= */

      if (
        request.method === "GET" &&
        url.pathname === "/api/shop"
      ) {
        const rows = await db.getSettings(env);

        return json(rows[0] || {});
      }


      if (
        request.method === "PATCH" &&
        url.pathname === "/api/shop"
      ) {
        await requireAuth(request, env);

        const body = await request.json();

        const updated = await db.updateSettings(
          env,
          body
        );

        return json(updated[0] || body);
      }


      /* ================= PUBLIC PRODUCTS ================= */

      if (
        request.method === "GET" &&
        url.pathname === "/api/products"
      ) {
        const products =
          await db.listProducts(env);

        return json(products);
      }


      /* ================= ADMIN LOGIN ================= */

      if (
        request.method === "POST" &&
        url.pathname === "/api/admin/login"
      ) {
        const body = await request.json();

        const email = String(
          body.email || ""
        )
          .toLowerCase()
          .trim();

        const password = String(
          body.password || ""
        );

        if (!email || !password) {
          return json(
            {
              error:
                "Email and password required"
            },
            400
          );
        }

        if (!env.JWT_SECRET) {
          return json(
            {
              error: "JWT_SECRET is missing"
            },
            500
          );
        }

        const rows =
          await db.findAdmin(env, email);

        const admin = rows?.[0];

        const passwordMatch = admin
          ? await bcrypt.compare(
              password,
              admin.password_hash
            )
          : false;

        if (!admin || !passwordMatch) {
          return json(
            {
              error:
                "Invalid email or password"
            },
            401
          );
        }

        const now =
          Math.floor(Date.now() / 1000);

        const token = await signJwt(
          {
            id: admin.id,
            email: admin.email,
            iat: now,
            exp: now + 8 * 60 * 60
          },
          env.JWT_SECRET
        );

        return json({
          token,
          admin: {
            email: admin.email
          }
        });
      }


      /* ================= CREATE PRODUCT ================= */

      if (
        request.method === "POST" &&
        url.pathname === "/api/products"
      ) {
        await requireAuth(request, env);

        const body = await request.json();
        const product = normalizeProduct(body);

        if (
          !product.name ||
          !product.category
        ) {
          return json(
            {
              error:
                "Name and category required"
            },
            400
          );
        }

        const created =
          await db.createProduct(
            env,
            product
          );

        return json(
          created?.[0] || created,
          201
        );
      }


      /* ================= UPDATE PRODUCT ================= */

      const productMatch =
        url.pathname.match(
          /^\/api\/products\/([^/]+)$/
        );

      if (
        request.method === "PATCH" &&
        productMatch
      ) {
        await requireAuth(request, env);

        const id =
          decodeURIComponent(
            productMatch[1]
          );

        const body =
          await request.json();

        const product =
          normalizeProduct(body);

        if (
          !product.name ||
          !product.category
        ) {
          return json(
            {
              error:
                "Name and category required"
            },
            400
          );
        }

        const updated =
          await db.updateProduct(
            env,
            id,
            product
          );

        return json(
          updated?.[0] || updated
        );
      }


      /* ================= DELETE PRODUCT ================= */

      if (
        request.method === "DELETE" &&
        productMatch
      ) {
        await requireAuth(request, env);

        const id =
          decodeURIComponent(
            productMatch[1]
          );

        await db.deleteProduct(
          env,
          id
        );

        return json({
          ok: true,
          deleted: id
        });
      }


      /* ================= KARIGAR API ================= */

      if (
        request.method === "GET" &&
        url.pathname === "/api/karigars"
      ) {
        const skill = String(
          url.searchParams.get("skill") || ""
        ).trim();

        const karigars =
          await db.listKarigars(env, skill);

        return json(karigars);
      }


      if (
        request.method === "POST" &&
        url.pathname === "/api/karigars"
      ) {
        await requireAuth(request, env);

        const body = await request.json();

        const name = String(body.name || "").trim();
        const phone = String(body.phone || "").trim();

        if (!name || !phone) {
          return json(
            {
              error: "Name and phone required"
            },
            400
          );
        }

        const skills = Array.isArray(body.skills)
          ? body.skills
              .map((skill) => String(skill).trim())
              .filter(Boolean)
          : [];

        const karigar = {
          name,
          phone,
          whatsapp: String(body.whatsapp || "").trim(),
          area: String(body.area || "").trim(),
          photo_url: String(body.photo_url || "").trim(),
          skills,
          experience_years:
            Number.isFinite(Number(body.experience_years))
              ? Number(body.experience_years)
              : 0,
          description:
            String(body.description || "").trim(),
          availability:
            ["available", "busy", "offline"].includes(
              body.availability
            )
              ? body.availability
              : "available"
        };

        const created =
          await db.createKarigar(
            env,
            karigar
          );

        return json(
          created?.[0] || created,
          201
        );
      }


      const karigarMatch =
        url.pathname.match(
          /^\/api\/karigars\/([^/]+)$/
        );


      if (
        request.method === "PATCH" &&
        karigarMatch
      ) {
        await requireAuth(request, env);

        const id =
          decodeURIComponent(
            karigarMatch[1]
          );

        const body = await request.json();

        const skills = Array.isArray(body.skills)
          ? body.skills
              .map((skill) => String(skill).trim())
              .filter(Boolean)
          : [];

        const karigar = {
          name: String(body.name || "").trim(),
          phone: String(body.phone || "").trim(),
          whatsapp: String(body.whatsapp || "").trim(),
          area: String(body.area || "").trim(),
          photo_url: String(body.photo_url || "").trim(),
          skills,
          experience_years:
            Number.isFinite(Number(body.experience_years))
              ? Number(body.experience_years)
              : 0,
          description:
            String(body.description || "").trim(),
          availability:
            ["available", "busy", "offline"].includes(
              body.availability
            )
              ? body.availability
              : "available"
        };

        if (!karigar.name || !karigar.phone) {
          return json(
            {
              error: "Name and phone required"
            },
            400
          );
        }

        const updated =
          await db.updateKarigar(
            env,
            id,
            karigar
          );

        return json(
          updated?.[0] || updated
        );
      }


      if (
        request.method === "DELETE" &&
        karigarMatch
      ) {
        await requireAuth(request, env);

        const id =
          decodeURIComponent(
            karigarMatch[1]
          );

        await db.deleteKarigar(
          env,
          id
        );

        return json({
          ok: true,
          deleted: id
        });
      }


      /* ================= IMAGE UPLOAD ================= */

      if (
        request.method === "POST" &&
        url.pathname ===
          "/api/admin/upload-product-image"
      ) {
        await requireAuth(request, env);

        if (
          !env.SUPABASE_URL ||
          !env.SUPABASE_SERVICE_ROLE_KEY
        ) {
          return json(
            {
              error:
                "Supabase environment variables are missing"
            },
            500
          );
        }

        const form =
          await request.formData();

        const file =
          form.get("image");

        if (
          !file ||
          typeof file.arrayBuffer !==
            "function"
        ) {
          return json(
            {
              error:
                "Image file required"
            },
            400
          );
        }

        if (
          !String(file.type || "")
            .startsWith("image/")
        ) {
          return json(
            {
              error:
                "Only image files are allowed"
            },
            400
          );
        }

        if (
          file.size >
          5 * 1024 * 1024
        ) {
          return json(
            {
              error:
                "Image maximum 5MB ki ho sakti hai"
            },
            400
          );
        }

        const originalName =
          String(
            file.name || "image.jpg"
          );

        const extension =
          originalName.includes(".")
            ? originalName
                .slice(
                  originalName
                    .lastIndexOf(".")
                )
                .toLowerCase()
            : ".jpg";

        const random =
          crypto.randomUUID()
            .replace(/-/g, "")
            .slice(0, 10);

        const fileName =
          `product-${Date.now()}-${random}${extension}`;

        const uploadUrl =
          `${env.SUPABASE_URL.replace(/\/$/, "")}` +
          `/storage/v1/object/products/` +
          encodeURIComponent(
            fileName
          );

        const uploadResponse =
          await fetch(uploadUrl, {
            method: "POST",
            headers: {
              apikey:
                env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization:
                `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type":
                file.type ||
                "application/octet-stream",
              "x-upsert": "true"
            },
            body:
              await file.arrayBuffer()
          });

        if (!uploadResponse.ok) {
          const errorText =
            await uploadResponse.text();

          throw new Error(
            `Supabase upload failed: ${errorText}`
          );
        }

        const imageUrl =
          `${env.SUPABASE_URL.replace(/\/$/, "")}` +
          `/storage/v1/object/public/products/` +
          encodeURIComponent(
            fileName
          );

        return json({
          ok: true,
          image_url: imageUrl,
          filename: fileName
        });
      }


      /* ================= FALLBACK ================= */

      return new Response(
        "Himanshu Hardware Worker is running",
        {
          status: 200,
          headers: {
            "content-type":
              "text/plain; charset=utf-8"
          }
        }
      );

    } catch (error) {
      console.error(
        "WORKER API ERROR:",
        error
      );

      const message =
        error?.message ||
        "Internal server error";

      const status =
        message.includes("Login required") ||
        message.includes("Invalid token") ||
        message.includes("Session expired")
          ? 401
          : 500;

      return json(
        {
          ok: false,
          error: message
        },
        status
      );
    }
  }
};
