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

/* ------------------------------------------------------------------ *
 * API key pool
 *
 * The Data API quota is per Google Cloud project, so several keys from
 * different projects multiply the daily budget. Keys come from
 * YOUTUBE_API_KEY (single value or comma/whitespace separated list) plus
 * optional YOUTUBE_API_KEY_2 … YOUTUBE_API_KEY_10. When a key reports
 * quotaExceeded we park it until the next Pacific-time daily reset and
 * continue with the next key.
 * ------------------------------------------------------------------ */

const exhausted = new Map<string, number>(); // key → timestamp when it becomes usable again

/** Ms until the next YouTube quota reset (midnight US/Pacific). */
function msUntilQuotaReset(): number {
  const now = new Date();
  // Pacific is UTC-7/-8; use -8 as the conservative (later) reset boundary.
  const pacificNow = new Date(now.getTime() - 8 * 3600 * 1000);
  const nextMidnight = Date.UTC(
    pacificNow.getUTCFullYear(),
    pacificNow.getUTCMonth(),
    pacificNow.getUTCDate() + 1,
  );
  return Math.max(60 * 1000, nextMidnight - pacificNow.getTime());
}

export function apiKeys(): string[] {
  const raw: string[] = [];
  const push = (value: string | undefined) => {
    if (value) raw.push(...value.split(/[\s,]+/));
  };
  push(process.env.YOUTUBE_API_KEY);
  for (let i = 2; i <= 10; i += 1) push(process.env[`YOUTUBE_API_KEY_${i}`]);
  return Array.from(new Set(raw.map((value) => value.trim()).filter(Boolean)));
}

/** Keys that are not currently parked for quota, in preferred order. */
export function availableApiKeys(): string[] {
  const all = apiKeys();
  const now = Date.now();
  for (const [key, until] of exhausted) if (until <= now) exhausted.delete(key);
  const live = all.filter((key) => !exhausted.has(key));
  return live.length ? live : all; // all parked → retry them anyway rather than fail hard
}

export function markKeyExhausted(key: string): void {
  exhausted.set(key, Date.now() + msUntilQuotaReset());
}

/** True when every configured key is currently parked for quota. */
export function allKeysExhausted(): boolean {
  const all = apiKeys();
  if (!all.length) return false;
  const now = Date.now();
  return all.every((key) => (exhausted.get(key) ?? 0) > now);
}

