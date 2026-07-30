/**
 * Time-and-season aware accent palette.
 *
 * The app keeps its light/dark surfaces, but the accent hue drifts through the
 * day (dawn -> day -> dusk -> night) and is nudged by the season, so the UI
 * feels different in a monsoon evening than on a summer morning.
 */

export type Daypart = "dawn" | "day" | "dusk" | "night";
export type Season = "spring" | "summer" | "monsoon" | "autumn" | "winter";

export interface Ambience {
  id: string;
  daypart: Daypart;
  season: Season;
  label: string;
  /** Accent hue in oklch degrees. */
  hue: number;
  /** Accent chroma. */
  chroma: number;
}

const DAYPARTS: Record<Daypart, { label: string; hue: number; chroma: number }> = {
  dawn: { label: "Dawn", hue: 40, chroma: 0.15 },
  day: { label: "Daylight", hue: 170, chroma: 0.17 },
  dusk: { label: "Dusk", hue: 15, chroma: 0.16 },
  night: { label: "Night", hue: 280, chroma: 0.14 },
};

/** Seasonal nudge applied on top of the daypart hue. */
const SEASONS: Record<Season, { label: string; hueShift: number; chromaShift: number }> = {
  spring: { label: "Spring", hueShift: 20, chromaShift: 0.01 },
  summer: { label: "Summer", hueShift: -10, chromaShift: 0.02 },
  monsoon: { label: "Monsoon", hueShift: 45, chromaShift: -0.02 },
  autumn: { label: "Autumn", hueShift: -25, chromaShift: 0.01 },
  winter: { label: "Winter", hueShift: 30, chromaShift: -0.01 },
};

export function daypartFor(hour: number): Daypart {
  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

/** Month-based seasons tuned for the Indian calendar. */
export function seasonFor(month: number): Season {
  if (month >= 2 && month <= 3) return "spring"; // Mar–Apr
  if (month >= 4 && month <= 5) return "summer"; // May–Jun
  if (month >= 6 && month <= 8) return "monsoon"; // Jul–Sep
  if (month >= 9 && month <= 10) return "autumn"; // Oct–Nov
  return "winter"; // Dec–Feb
}

export function getAmbience(date = new Date()): Ambience {
  const daypart = daypartFor(date.getHours());
  const season = seasonFor(date.getMonth());
  const d = DAYPARTS[daypart];
  const s = SEASONS[season];
  const hue = (d.hue + s.hueShift + 360) % 360;
  const chroma = Math.max(0.08, Math.min(0.2, d.chroma + s.chromaShift));
  return {
    id: `${daypart}-${season}`,
    daypart,
    season,
    label: `${d.label} · ${s.label}`,
    hue,
    chroma,
  };
}

/** Writes the ambience accent tokens onto <html> as inline custom properties. */
export function applyAmbience(ambience: Ambience, mode: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const { hue, chroma } = ambience;
  const light = mode === "light";

  const l = light ? 0.65 : 0.72;
  const c = light ? chroma + 0.01 : chroma;
  const primary = `oklch(${l.toFixed(2)} ${c.toFixed(3)} ${hue.toFixed(1)})`;
  const soft = `oklch(${(l - 0.1).toFixed(2)} ${(c - 0.02).toFixed(3)} ${hue.toFixed(1)})`;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--mint", primary);
  root.style.setProperty("--mint-soft", soft);
  root.style.setProperty("--ring", `oklch(${l.toFixed(2)} ${c.toFixed(3)} ${hue.toFixed(1)} / 55%)`);
  root.style.setProperty("--chart-1", primary);
  root.style.setProperty("--shadow-glow", `0 0 60px -12px ${primary.replace(")", " / 35%)")}`);
  root.style.setProperty("--artwork-outer-hue", hue.toFixed(1));
  root.style.setProperty(
    "--primary-foreground",
    light ? "oklch(0.99 0.01 " + hue.toFixed(1) + ")" : "oklch(0.16 0.02 230)",
  );
  root.dataset.daypart = ambience.daypart;
  root.dataset.season = ambience.season;
}
