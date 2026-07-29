import type { Track } from "./types";

/**
 * Server-side cache for YouTube search results.
 *
 * The Data API v3 has a hard daily quota (100 units for a search call), so
 * repeated identical searches — retries, remounts, multiple visitors typing the
 * same thing — quickly produce 429 / quotaExceeded responses. Results are held
 * in the worker isolate's memory with a TTL, plus:
 *  - in-flight de-duplication so concurrent identical searches make one call
 *  - negative caching so a quota failure doesn't re-hit the API every keystroke
 */

const TTL_MS = 30 * 60 * 1000; // successful results stay fresh for 30 minutes
const QUOTA_TTL_MS = 10 * 60 * 1000; // back off for 10 minutes after a quota error
const MAX_ENTRIES = 300;

interface CacheEntry {
  tracks: Track[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Track[]>>();

export function cacheKey(query: string, limit: number): string {
  return `${query.trim().toLowerCase()}::${limit}`;
}

export function readCache(key: string): Track[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // refresh LRU position
  cache.delete(key);
  cache.set(key, entry);
  return entry.tracks;
}

export function writeCache(key: string, tracks: Track[], ttlMs = TTL_MS): void {
  cache.set(key, { tracks, expiresAt: Date.now() + ttlMs });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Remember an empty result from a quota/rate-limit failure for a shorter window. */
export function writeQuotaMiss(key: string): void {
  writeCache(key, [], QUOTA_TTL_MS);
}

/** Runs `fetcher` once per key even if called concurrently. */
export function dedupe(key: string, fetcher: () => Promise<Track[]>): Promise<Track[]> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
