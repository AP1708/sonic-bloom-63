/**
 * Discovery motion preferences.
 *
 * Shared, browser-safe definitions used by the provider, the settings UI and
 * the server functions that sync the choice to the signed-in profile.
 */

export const MOTION_STYLES = ["rise", "fade", "pop", "slide", "off"] as const;
export type MotionStyle = (typeof MOTION_STYLES)[number];

export interface MotionPrefs {
  style: MotionStyle;
  /** 1–5. Scales travel distance and scale amount. */
  intensity: number;
  /** Entrance duration for a single card, in ms. */
  durationMs: number;
  /** Delay added per card position, in ms. */
  staggerMs: number;
  /** How long the "New" badge stays. 0 = until the next refresh. */
  badgeMs: number;
  /** Honour the operating system's reduced-motion setting. */
  respectReducedMotion: boolean;
}

export const DEFAULT_MOTION_PREFS: MotionPrefs = {
  style: "rise",
  intensity: 3,
  durationMs: 520,
  staggerMs: 40,
  badgeMs: 12000,
  respectReducedMotion: true,
};

export const BADGE_OPTIONS = [
  { label: "4s", value: 4000 },
  { label: "12s", value: 12000 },
  { label: "30s", value: 30000 },
  { label: "Until next refresh", value: 0 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

/** Coerces any stored/remote shape into a complete, in-range preference. */
export function normalizeMotionPrefs(input: unknown): MotionPrefs {
  const raw = (input ?? {}) as Partial<Record<keyof MotionPrefs, unknown>>;
  const style = MOTION_STYLES.includes(raw.style as MotionStyle)
    ? (raw.style as MotionStyle)
    : DEFAULT_MOTION_PREFS.style;

  return {
    style,
    intensity:
      typeof raw.intensity === "number"
        ? clamp(raw.intensity, 1, 5)
        : DEFAULT_MOTION_PREFS.intensity,
    durationMs:
      typeof raw.durationMs === "number"
        ? clamp(raw.durationMs, 200, 900)
        : DEFAULT_MOTION_PREFS.durationMs,
    staggerMs:
      typeof raw.staggerMs === "number"
        ? clamp(raw.staggerMs, 0, 120)
        : DEFAULT_MOTION_PREFS.staggerMs,
    badgeMs:
      typeof raw.badgeMs === "number" ? clamp(raw.badgeMs, 0, 120000) : DEFAULT_MOTION_PREFS.badgeMs,
    respectReducedMotion:
      typeof raw.respectReducedMotion === "boolean"
        ? raw.respectReducedMotion
        : DEFAULT_MOTION_PREFS.respectReducedMotion,
  };
}

export function motionPrefsEqual(a: MotionPrefs, b: MotionPrefs): boolean {
  return (
    a.style === b.style &&
    a.intensity === b.intensity &&
    a.durationMs === b.durationMs &&
    a.staggerMs === b.staggerMs &&
    a.badgeMs === b.badgeMs &&
    a.respectReducedMotion === b.respectReducedMotion
  );
}

/**
 * Writes the preference onto <html> as CSS variables + data attributes so the
 * animation utilities in styles.css can read it without any per-card JS.
 */
export function applyMotionPrefs(prefs: MotionPrefs, reduced: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const active = prefs.style !== "off" && !(prefs.respectReducedMotion && reduced);

  root.dataset.animStyle = active ? prefs.style : "off";
  root.dataset.animReduced = active ? "false" : "true";
  root.style.setProperty("--anim-card-duration", `${prefs.durationMs}ms`);
  root.style.setProperty("--anim-card-stagger", `${prefs.staggerMs}ms`);
  root.style.setProperty("--anim-card-shift", `${prefs.intensity * 4}px`);
  root.style.setProperty("--anim-card-scale", `${1 - prefs.intensity * 0.015}`);
  root.style.setProperty("--anim-badge-duration", `${prefs.badgeMs || 12000}ms`);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
