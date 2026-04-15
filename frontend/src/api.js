const TOKEN_KEY = "protrades_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (!headers["Content-Type"] && opts.body && typeof opts.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(path, { ...opts, headers });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || r.statusText);
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return r.json();
  return r.text();
}
