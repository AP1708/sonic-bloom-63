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

/** Keys that are not currently parked for quota, healthy ones first. */
export function availableApiKeys(): string[] {
  const all = apiKeys();
  const now = Date.now();
  for (const [key, until] of exhausted) if (until <= now) exhausted.delete(key);
  const live = all.filter((key) => !exhausted.has(key));
  const pool = live.length ? live : all; // all parked → retry them anyway rather than fail hard
  // Prefer keys the health probe last saw working; unknown keys sit in the middle.
  const rank = (key: string) => {
    const state = health.get(key);
    if (!state) return 1;
    return state.healthy ? 0 : 2;
  };
  return [...pool].sort((a, b) => rank(a) - rank(b));
}

export function markKeyExhausted(key: string): void {
  exhausted.set(key, Date.now() + msUntilQuotaReset());
  health.set(key, { healthy: false, checkedAt: Date.now(), reason: "quota exceeded" });
}

/** True when every configured key is currently parked for quota. */
export function allKeysExhausted(): boolean {
  const all = apiKeys();
  if (!all.length) return false;
  const now = Date.now();
  return all.every((key) => (exhausted.get(key) ?? 0) > now);
}

/* ------------------------------------------------------------------ *
 * Key health probing
 *
 * A background job (pg_cron → /api/public/hooks/youtube-key-health) pings
 * each configured key with a 1-unit `videos.list` call. Keys that answer
 * are marked healthy and float to the front of the rotation; keys that
 * report quota errors are parked until the daily reset, and keys that are
 * invalid/disabled are marked unhealthy so real searches skip them first.
 * ------------------------------------------------------------------ */

interface KeyHealth {
  healthy: boolean;
  checkedAt: number;
  reason?: string;
}

const health = new Map<string, KeyHealth>();

/** Masked identifier so keys are never echoed in responses or logs. */
export function keyFingerprint(key: string): string {
  return `…${key.slice(-6)}`;
}

export function markKeyHealthy(key: string): void {
  exhausted.delete(key);
  health.set(key, { healthy: true, checkedAt: Date.now() });
}

export function markKeyUnhealthy(key: string, reason: string): void {
  health.set(key, { healthy: false, checkedAt: Date.now(), reason });
}

export interface KeyHealthReport {
  key: string;
  healthy: boolean | null;
  checkedAt: string | null;
  reason?: string;
  parkedUntil: string | null;
}

export function keyHealthReport(): KeyHealthReport[] {
  const now = Date.now();
  return apiKeys().map((key) => {
    const state = health.get(key);
    const until = exhausted.get(key);
    return {
      key: keyFingerprint(key),
      healthy: state ? state.healthy : null,
      checkedAt: state ? new Date(state.checkedAt).toISOString() : null,
      reason: state?.reason,
      parkedUntil: until && until > now ? new Date(until).toISOString() : null,
    };
  });
}

/** Cheap availability probe (1 quota unit per key). */
export async function probeApiKeys(): Promise<KeyHealthReport[]> {
  const keys = apiKeys();
  await Promise.all(
    keys.map(async (key) => {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "id");
      url.searchParams.set("id", "dQw4w9WgXcQ");
      url.searchParams.set("key", key);
      try {
        const res = await fetch(url);
        if (res.ok) {
          markKeyHealthy(key);
          return;
        }
        const body = await res.text();
        if (res.status === 429 || (res.status === 403 && /quota|rateLimit/i.test(body))) {
          markKeyExhausted(key);
          return;
        }
        markKeyUnhealthy(key, `HTTP ${res.status}`);
      } catch (error) {
        markKeyUnhealthy(key, error instanceof Error ? error.message : "network error");
      }
    }),
  );
  return keyHealthReport();
}



/* ------------------------------------------------------------------ *
 * Keyless fallback search
 *
 * The Data API allows only ~100 searches per key per day. When every key
 * is out of search quota we fall back to YouTube's own public web search
 * endpoint (the same one youtube.com uses), which needs no project key.
 * It returns video IDs that play in the official IFrame player, so audio
 * keeps working for Spotify matches and YouTube results all day.
 * ------------------------------------------------------------------ */

const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // public web-client key
const VIDEO_FILTER = "EgIQAQ%3D%3D"; // type=video

interface VideoRenderer {
  videoId?: string;
  title?: { runs?: { text?: string }[]; simpleText?: string };
  ownerText?: { runs?: { text?: string }[] };
  longBylineText?: { runs?: { text?: string }[] };
  lengthText?: { simpleText?: string };
  thumbnail?: { thumbnails?: { url: string }[] };
}

function collectRenderers(node: unknown, out: VideoRenderer[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectRenderers(item, out);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "videoRenderer" && value && typeof value === "object") {
      out.push(value as VideoRenderer);
      continue;
    }
    collectRenderers(value, out);
  }
}

function parseClockDuration(value: string | undefined): number {
  if (!value) return 0;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export async function innertubeSearch(query: string, limit: number): Promise<Track[]> {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: { clientName: "WEB", clientVersion: "2.20240401.00.00", hl: "en", gl: "US" },
        },
        query,
        params: VIDEO_FILTER,
      }),
    },
  );
  if (!res.ok) throw new Error(`YouTube web search failed (${res.status})`);

  const renderers: VideoRenderer[] = [];
  collectRenderers(await res.json(), renderers);

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const item of renderers) {
    const videoId = item.videoId;
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    const rawTitle = item.title?.runs?.[0]?.text ?? item.title?.simpleText ?? "";
    if (!rawTitle) continue;
    const channel =
      item.ownerText?.runs?.[0]?.text ?? item.longBylineText?.runs?.[0]?.text ?? "YouTube";
    const thumbs = item.thumbnail?.thumbnails ?? [];
    tracks.push({
      id: `yt-${videoId}`,
      source: "youtube",
      title: rawTitle,
      artist: channel,
      artworkUrl: thumbs[thumbs.length - 1]?.url ?? null,
      durationSec: parseClockDuration(item.lengthText?.simpleText),
      audioUrl: null,
      youtubeVideoId: videoId,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
    if (tracks.length >= limit) break;
  }
  return tracks;
}
