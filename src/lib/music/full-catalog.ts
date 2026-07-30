import type { Track } from "./types";

/**
 * Full public-domain catalog (~4,100 recordings by 30+ Indian playback singers).
 *
 * The dataset is a static JSON file rather than a bundled module so it stays out
 * of the JS bundle and is fetched (and HTTP-cached) once, on demand.
 */

interface CatalogPayload {
  base: string;
  items: string[];
  artists: string[];
  /** [songId, itemIndex, fileName, title, artistIndex, film, year, durationSec] */
  tracks: [string, number, string, string, number, string, string, number][];
}

export interface ArtistSummary {
  id: string;
  name: string;
  trackCount: number;
}

export interface FullCatalog {
  tracks: Track[];
  byArtist: Map<string, Track[]>;
  artists: ArtistSummary[];
}

export function artistSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Safe lookup for an artist's tracks. The catalog can come back from the
 * persisted query cache, where the Map has been rehydrated as a plain object
 * (or dropped entirely), so fall back to scanning tracks.
 */
export function artistTracks(catalog: FullCatalog | undefined | null, artistId: string): Track[] {
  if (!catalog) return [];
  const index = catalog.byArtist as unknown;
  if (index instanceof Map) return index.get(artistId) ?? [];
  if (index && typeof index === "object") {
    const bucket = (index as Record<string, Track[]>)[artistId];
    if (Array.isArray(bucket)) return bucket;
  }
  return (catalog.tracks ?? []).filter((track) => artistSlug(track.artist) === artistId);
}

let cached: Promise<FullCatalog> | null = null;

export function loadFullCatalog(): Promise<FullCatalog> {
  if (cached) return cached;
  cached = fetch("/catalog/tracks.json")
    .then((res) => {
      if (!res.ok) throw new Error(`Catalog unavailable (${res.status})`);
      return res.json() as Promise<CatalogPayload>;
    })
    .then((payload) => {
      const tracks: Track[] = payload.tracks.map(
        ([songId, itemIndex, file, title, artistIndex, film, year, durationSec]) => {
          const item = payload.items[itemIndex];
          const artist = payload.artists[artistIndex];
          const album = film ? (year ? `${film} (${year})` : film) : year || "Vintage recording";
          return {
            id: `in-${songId}`,
            source: "archive" as const,
            title,
            artist,
            album,
            artworkUrl: null,
            durationSec,
            audioUrl: `${payload.base}/${item}/${file}`,
            externalUrl: `https://archive.org/details/${item}`,
          };
        },
      );

      const byArtist = new Map<string, Track[]>();
      for (const track of tracks) {
        const key = artistSlug(track.artist);
        const bucket = byArtist.get(key);
        if (bucket) bucket.push(track);
        else byArtist.set(key, [track]);
      }
      for (const bucket of byArtist.values()) {
        bucket.sort((a, b) => a.title.localeCompare(b.title));
      }

      const artists: ArtistSummary[] = [...byArtist.entries()]
        .map(([id, list]) => ({ id, name: list[0].artist, trackCount: list.length }))
        .sort((a, b) => b.trackCount - a.trackCount);

      return { tracks, byArtist, artists };
    })
    .catch((error) => {
      cached = null;
      throw error;
    });
  return cached;
}

export function searchFullCatalog(catalog: FullCatalog, query: string, limit = 40): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog.tracks.slice(0, limit);
  const out: Track[] = [];
  for (const track of catalog.tracks) {
    if (
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      (track.album ?? "").toLowerCase().includes(q)
    ) {
      out.push(track);
      if (out.length >= limit) break;
    }
  }
  return out;
}
