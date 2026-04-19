import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SessionDataContext = createContext(null);

export function SessionDataProvider({ children }) {
  const [cache, setCache] = useState({});
  const [refreshing, setRefreshing] = useState({});
  const [errors, setErrors] = useState({});

  const setCachedData = useCallback((key, data) => {
    setCache((prev) => ({ ...prev, [key]: data }));
  }, []);

  const setRefreshingKey = useCallback((key, isRefreshing) => {
    setRefreshing((prev) => ({ ...prev, [key]: !!isRefreshing }));
  }, []);

  const setErrorKey = useCallback((key, err) => {
    setErrors((prev) => ({ ...prev, [key]: err }));
  }, []);

  const clearAll = useCallback(() => {
    setCache({});
    setRefreshing({});
    setErrors({});
  }, []);

  const value = useMemo(
    () => ({
      cache,
      refreshing,
      errors,
      setCachedData,
      setRefreshingKey,
      setErrorKey,
      clearAll,
    }),
    [cache, refreshing, errors, setCachedData, setRefreshingKey, setErrorKey, clearAll]
  );

  return (
    <SessionDataContext.Provider value={value}>{children}</SessionDataContext.Provider>
  );
}

export function useSessionData() {
  const ctx = useContext(SessionDataContext);
  if (!ctx) {
    throw new Error("useSessionData must be used within SessionDataProvider");
  }
  return ctx;
}

/**
 * Loads data once per key; keeps last successful payload in memory for the SPA session.
 * On each mount / reloadToken bump: shows cached data immediately (if any), sets refreshing, then updates.
 */
export function useSessionCachedFetch(key, loader) {
  const { cache, refreshing, errors, setCachedData, setRefreshingKey, setErrorKey } = useSessionData();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRefreshingKey(key, true);
      setErrorKey(key, null);
      try {
        const result = await loader();
        if (!cancelled) {
          setCachedData(key, result);
        }
      } catch (e) {
        if (!cancelled) {
          setErrorKey(key, e?.message || String(e));
        }
      } finally {
        if (!cancelled) {
          setRefreshingKey(key, false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, reloadToken, loader, setCachedData, setRefreshingKey, setErrorKey]);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return {
    data: cache[key],
    refreshing: !!refreshing[key],
    error: errors[key] || null,
    reload,
    hasCache: cache[key] !== undefined,
  };
}

/** Banner under page title: “Loading…” or “Refreshing latest data…” */
export function SessionRefreshBanner({ cacheKey }) {
  const { cache, refreshing } = useSessionData();
  if (!refreshing[cacheKey]) return null;
  const hasData = cache[cacheKey] !== undefined;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs font-medium text-primary">
      <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
      {hasData ? "Refreshing latest data…" : "Loading…"}
    </div>
  );
}
