function supabaseBase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing");
  }

  return `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
}

async function request(env, path, options = {}) {
  const response = await fetch(`${supabaseBase(env)}${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : JSON.stringify(data)
    );
  }

  return data;
}

export const db = {
  listProducts: (env) =>
    request(env, "/products?select=*&order=created_at.desc"),

  createProduct: (env, product) =>
    request(env, "/products", {
      method: "POST",
      body: JSON.stringify(product)
    }),

  updateProduct: (env, id, product) =>
    request(
      env,
      `/products?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...product,
          updated_at: new Date().toISOString()
        })
      }
    ),

  deleteProduct: (env, id) =>
    request(
      env,
      `/products?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    ),

  getSettings: (env) =>
    request(env, "/shop_settings?id=eq.1&select=*"),

  updateSettings: (env, data) =>
    request(env, "/shop_settings?id=eq.1", {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        updated_at: new Date().toISOString()
      })
    }),

  findAdmin: (env, email) =>
  request(
    env,
    `/admins?email=eq.${encodeURIComponent(email)}&select=*`
  ),

listKarigars: (env, skill = "") => {
  const query = skill
    ? `/karigars?select=*&skills=cs.{${encodeURIComponent(skill)}}&order=created_at.desc`
    : "/karigars?select=*&order=created_at.desc";

  return request(env, query);
},

createKarigar: (env, karigar) =>
  request(env, "/karigars", {
    method: "POST",
    body: JSON.stringify(karigar)
  }),

updateKarigar: (env, id, karigar) =>
  request(
    env,
    `/karigars?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...karigar,
        updated_at: new Date().toISOString()
      })
    }
  ),

deleteKarigar: (env, id) =>
  request(
    env,
    `/karigars?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE"
    }
  )
};
