import { useEffect, useState } from "react";
import { api } from "../api.js";

/** Loads /api/webhook-urls once (TradingView, ChartInk, AmiBroker, Python, …). */
export function useWebhookUrls() {
  const [urls, setUrls] = useState({});
  useEffect(() => {
    api("/api/webhook-urls")
      .then(setUrls)
      .catch(() => setUrls({}));
  }, []);
  return urls;
}

export function copyText(t) {
  return navigator.clipboard.writeText(t);
}
