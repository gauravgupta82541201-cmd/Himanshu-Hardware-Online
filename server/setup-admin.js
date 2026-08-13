import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./supabase.js";

const email = (process.env.ADMIN_EMAIL || "admin@himanshuhardware.local")
  .toLowerCase()
  .trim();

const password = process.env.ADMIN_PASSWORD || "";

if (!password || password === "change-this-password") {
  console.error("Set ADMIN_PASSWORD in .env before running setup-admin.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const existing = await db.findAdmin(email);

const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
const headers = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal"
};

if (existing.length) {
  const id = existing[0].id;

  const response = await fetch(
    `${baseUrl}/rest/v1/admins?id=eq.${id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        email,
        password_hash: hash
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  console.log("Admin password updated:", email);
} else {
  const response = await fetch(`${baseUrl}/rest/v1/admins`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password_hash: hash
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  console.log("Admin created:", email);
}
