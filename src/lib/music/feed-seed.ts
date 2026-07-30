/**
 * Feed seed — controls how the home feed is sampled and which discovery
 * queries run.
 *
 * The feed should look different every time the app is opened, so the seed is
 * rotated on a cold open and again whenever the app comes back to the
 * foreground after being away for a while. It is persisted in localStorage so
 * a reload or PWA restart continues from a known value rather than flashing a
 * different feed mid-session.
 */

import { useEffect, useState } from "react";

const SEED_KEY = "feed-seed";
const HIDDEN_KEY = "feed-seed-hidden-at";

/** Returning after this long counts as "opening the app again". */
const REOPEN_AFTER_MS = 20 * 60 * 1000;

/** Stable value used during SSR so the server and first client render agree. */
const SSR_SEED = 1;

let current = SSR_SEED;
let started = false;
const listeners = new Set<(seed: number) => void>();

function mint(): number {
  return Math.floor(Math.random() * 1_000_000) + 1;
}

function emit(seed: number) {
  current = seed;
  for (const listener of listeners) listener(seed);
}

/** Force a new seed (manual refresh button, or a fresh open). */
export function rotateFeedSeed(): number {
  const seed = mint();
  try {
    window.localStorage.setItem(SEED_KEY, String(seed));
    window.localStorage.removeItem(HIDDEN_KEY);
  } catch {
    /* storage can be unavailable in private modes — the seed still works in memory */
  }
  emit(seed);
  return seed;
}

/** Current seed without subscribing. */
export function feedSeed(): number {
  return current;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Every fresh page load is an "open", so the feed always starts different.
  rotateFeedSeed();

  // Coming back to the foreground after a long time away counts as reopening.
  document.addEventListener("visibilitychange", () => {
    try {
      if (document.visibilityState !== "visible") {
        window.localStorage.setItem(HIDDEN_KEY, String(Date.now()));
        return;
      }
      const hiddenAt = Number(window.localStorage.getItem(HIDDEN_KEY)) || 0;
      window.localStorage.removeItem(HIDDEN_KEY);
      if (hiddenAt && Date.now() - hiddenAt > REOPEN_AFTER_MS) rotateFeedSeed();
    } catch {
      /* ignore */
    }
  });
}



/**
 * Subscribe to the feed seed. Returns the SSR seed on the server and during
 * hydration, then the rotated value once mounted, so markup stays consistent.
 */
export function useFeedSeed(): number {
  const [seed, setSeed] = useState(SSR_SEED);

  useEffect(() => {
    start();
    setSeed(current);
    const listener = (next: number) => setSeed(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return seed;
}

/** Small, fast deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded shuffle — same seed gives the same order. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Seeded pick of `count` items spread across the pool. */
export function seededSample<T>(items: T[], count: number, seed: number): T[] {
  if (items.length <= count) return [...items];
  return seededShuffle(items, seed).slice(0, count);
}
