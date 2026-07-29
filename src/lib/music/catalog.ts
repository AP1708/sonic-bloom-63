import type { Collection, LyricLine, Shelf, Track } from "./types";

/**
 * Demo catalog. This exists so the app shell is fully explorable before the
 * Spotify / YouTube credentials are wired in. Every provider in
 * `./providers.ts` falls back to this set when its API key is absent, so no
 * component ever depends on the demo data directly.
 */

function t(
  id: string,
  title: string,
  artist: string,
  album: string,
  durationSec: number,
  source: Track["source"],
): Track {
  return { id, title, artist, album, durationSec, source, artworkUrl: null };
}

export const DEMO_TRACKS: Track[] = [
  t("sp-1", "Subsurface Tension", "Arlowe Vance", "Modular Nights", 262, "spotify"),
  t("sp-2", "Thermal Expansion", "Arlowe Vance", "Modular Nights", 248, "spotify"),
  t("sp-3", "Static Drift", "Arlowe Vance", "Modular Nights", 311, "spotify"),
  t("sp-4", "Obsidian Echoes", "The Monolith Project", "Obsidian", 205, "spotify"),
  t("sp-5", "Low Ceiling Light", "The Monolith Project", "Obsidian", 194, "spotify"),
  t("sp-6", "Amber Hours", "Dusk Theory", "Amber Hours", 226, "spotify"),
  t("sp-7", "Nordic Calm", "Halvard Ek", "Field Notes", 288, "spotify"),
  t("sp-8", "Paper Lanterns", "Halvard Ek", "Field Notes", 199, "spotify"),
  t("yt-1", "Night Bus (Live Session)", "Elowen Thorne", "Live at Bellwether", 341, "youtube"),
  t("yt-2", "Cassette Sunrise", "Elowen Thorne", "Singles", 236, "youtube"),
  t("yt-3", "Analog Dreams", "Waveform Labs", "Analog Dreams", 275, "youtube"),
  t("yt-4", "Phase Shift", "Waveform Labs", "Analog Dreams", 254, "youtube"),
  t("yt-5", "Neon Architecture", "System 01", "Hardware Interface", 219, "youtube"),
  t("yt-6", "Pulse Reactor", "System 01", "Hardware Interface", 243, "youtube"),
  t("yt-7", "Slow Mornings", "Study Beats Collective", "Slow Mornings", 182, "youtube"),
  t("yt-8", "Into the Canopy", "Looming Woods", "Canopy", 297, "youtube"),
];

export const TRACKS_BY_ID = new Map(DEMO_TRACKS.map((track) => [track.id, track]));

function collection(
  id: string,
  title: string,
  subtitle: string,
  kind: Collection["kind"],
  source: Collection["source"],
  trackIds: string[],
): Collection {
  return { id, title, subtitle, kind, source, trackIds };
}

export const DEMO_COLLECTIONS: Collection[] = [
  collection("c-modular", "Modular Nights", "Arlowe Vance", "album", "spotify", [
    "sp-1",
    "sp-2",
    "sp-3",
  ]),
  collection("c-obsidian", "Obsidian", "The Monolith Project", "album", "spotify", ["sp-4", "sp-5"]),
  collection("c-amber", "Amber Hours", "Dusk Theory", "album", "spotify", ["sp-6"]),
  collection("c-field", "Field Notes", "Halvard Ek", "album", "spotify", ["sp-7", "sp-8"]),
  collection("c-live", "Live at Bellwether", "Elowen Thorne", "album", "youtube", ["yt-1", "yt-2"]),
  collection("c-analog", "Analog Dreams", "Waveform Labs", "album", "youtube", ["yt-3", "yt-4"]),
  collection("c-hardware", "Hardware Interface", "System 01", "album", "youtube", [
    "yt-5",
    "yt-6",
  ]),
  collection("c-slow", "Slow Mornings", "Study Beats Collective", "mix", "youtube", ["yt-7"]),
  collection("c-canopy", "Canopy", "Looming Woods", "album", "youtube", ["yt-8"]),
];

export const COLLECTIONS_BY_ID = new Map(DEMO_COLLECTIONS.map((c) => [c.id, c]));

export function tracksForCollection(collectionId: string): Track[] {
  const found = COLLECTIONS_BY_ID.get(collectionId);
  if (!found) return [];
  return found.trackIds.map((id) => TRACKS_BY_ID.get(id)).filter((x): x is Track => Boolean(x));
}

export const DEMO_SHELVES: Shelf[] = [
  {
    id: "shelf-recent",
    title: "Pick up where you left off",
    caption: "Recently played",
    items: DEMO_COLLECTIONS.slice(0, 5),
  },
  {
    id: "shelf-night",
    title: "Suggested for night listening",
    caption: "Recommended by the mix engine",
    items: [...DEMO_COLLECTIONS].reverse().slice(0, 5),
  },
  {
    id: "shelf-cross",
    title: "Crossing sources",
    caption: "Matched across Spotify and YouTube",
    items: DEMO_COLLECTIONS.slice(3, 8),
  },
];

export const DEMO_LYRICS: LyricLine[] = [
  { timeSec: 0, text: "Caught in the flow of the static tide" },
  { timeSec: 9, text: "Where the signals cross and the light begins to hide" },
  { timeSec: 19, text: "Low ceiling hum, a room that never sleeps" },
  { timeSec: 28, text: "We trade the noise for something that we keep" },
  { timeSec: 38, text: "Turn the dial down, let the pressure equalize" },
  { timeSec: 47, text: "Subsurface tension underneath the quiet skies" },
  { timeSec: 57, text: "Every chorus is a room we walk inside" },
  { timeSec: 66, text: "And the last note holds until the morning" },
];
