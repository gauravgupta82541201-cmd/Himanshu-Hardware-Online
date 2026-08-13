import { db } from "./supabase.js";

function json(data, status = 200) {
  return Response.json(data, { status });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      /* ---------- HEALTH ---------- */

      if (request.method === "GET" && url.pathname === "/api/health") {
        await db.getSettings(env);

        return json({
          ok: true,
          database: "online",
          runtime: "cloudflare-worker"
        });
      }

      /* ---------- SHOP ---------- */

      if (request.method === "GET" && url.pathname === "/api/shop") {
        const rows = await db.getSettings(env);

        return json(rows[0] || {});
      }

      /* ---------- PUBLIC PRODUCTS ---------- */

      if (
        request.method === "GET" &&
        url.pathname === "/api/products"
      ) {
        const products = await db.listProducts(env);

        return json(products);
      }

      /* ---------- WORKER TEST ---------- */

      return new Response(
        "Himanshu Hardware Worker is running",
        {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8"
          }
        }
      );

    } catch (error) {
      console.error("WORKER API ERROR:", error);

      return json(
        {
          ok: false,
          error: error?.message || "Internal server error"
        },
        500
      );
    }
  }
};
