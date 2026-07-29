import type { QueryClient } from "@tanstack/react-query";

/**
 * Offline-ready caching for APP DATA ONLY (playlists, metadata, library rows).
 * No copyrighted media is ever cached — audio and video always stream from the
 * official embedded players.
 */

const STORAGE_KEY = "sonance.query-cache.v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h

interface PersistedEntry {
  key: unknown;
  data: unknown;
  at: number;
}

export function hydrateQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as PersistedEntry[];
    const now = Date.now();
    for (const entry of entries) {
      if (now - entry.at > MAX_AGE_MS) continue;
      queryClient.setQueryData(entry.key as never, entry.data as never, { updatedAt: entry.at });
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function persistQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return () => {};

  const write = () => {
    try {
      const entries: PersistedEntry[] = queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.status === "success" && query.state.data !== undefined)
        .slice(-80)
        .map((query) => ({
          key: query.queryKey,
          data: query.state.data,
          at: query.state.dataUpdatedAt,
        }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* quota or serialization issues are non-fatal */
    }
  };

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    clearTimeout(timeout);
    timeout = setTimeout(write, 1200);
  });

  return () => {
    clearTimeout(timeout);
    unsubscribe();
  };
}

export function clearPersistedCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
