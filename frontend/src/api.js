const TOKEN_KEY = "protrades_token";

function _joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  if (!b) return p;
  if (!p) return b;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${b}/${p.replace(/^\/+/, "")}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Persist ProTrades JWT after login (password, SSO paste, or guest). Returns false if missing/invalid. */
export function saveAuthSession(accessToken) {
  if (accessToken == null || typeof accessToken !== "string" || !accessToken.trim()) {
    return false;
  }
  try {
    localStorage.setItem(TOKEN_KEY, accessToken.trim());
    return true;
  } catch {
    return false;
  }
}

export async function api(path, opts = {}) {
  const base = import.meta.env?.VITE_API_BASE_URL || "";
  const headers = { ...(opts.headers || {}) };
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (!headers["Content-Type"] && opts.body && typeof opts.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const url = _joinUrl(base, path);
  const r = await fetch(url, { ...opts, headers });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || r.statusText);
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return r.json();
  return r.text();
}
