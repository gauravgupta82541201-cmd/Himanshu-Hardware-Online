const base = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing");
  }
  return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
};

async function request(path, options = {}) {
  const response = await fetch(`${base()}${path}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

export const db = {
  listProducts: () => request("/products?select=*&order=created_at.desc"),
  getProduct: (id) => request(`/products?id=eq.${encodeURIComponent(id)}&select=*`),
  createProduct: (p) => request("/products", {method:"POST", body:JSON.stringify(p)}),
  updateProduct: (id,p) => request(`/products?id=eq.${encodeURIComponent(id)}`, {method:"PATCH", body:JSON.stringify({...p,updated_at:new Date().toISOString()})}),
  deleteProduct: (id) => request(`/products?id=eq.${encodeURIComponent(id)}`, {method:"DELETE"}),
  getSettings: () => request("/shop_settings?id=eq.1&select=*"),
  updateSettings: (p) => request("/shop_settings?id=eq.1", {method:"PATCH", body:JSON.stringify({...p,updated_at:new Date().toISOString()})}),
  findAdmin: (email) => request(`/admins?email=eq.${encodeURIComponent(email)}&select=*`)
};