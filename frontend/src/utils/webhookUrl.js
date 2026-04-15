/** Append ProTrades API key for platforms that cannot set X-ProTrades-Key header. */
export function appendWebhookKey(baseUrl, key) {
  if (!baseUrl?.trim() || !key?.trim()) return baseUrl;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(key.trim())}`;
}
