/**
 * Per-session feed seed.
 *
 * The home feed should look different every time the app is opened, but stay
 * stable while you are using it (so rails don't reshuffle on every render).
 * A seed is generated once per browser session and reused from sessionStorage.
 */

const SEED_KEY = "feed-seed";

let cached: number | null = null;

export function feedSeed(): number {
  if (cached !== null) return cached;
  if (typeof window === "undefined") return 1;
  const stored = window.sessionStorage.getItem(SEED_KEY);
  const parsed = stored ? Number(stored) : NaN;
  const seed = Number.isFinite(parsed) && parsed > 0 ? parsed : Math.floor(Math.random() * 1_000_000) + 1;
  window.sessionStorage.setItem(SEED_KEY, String(seed));
  cached = seed;
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
