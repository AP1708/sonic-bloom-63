import { createServerFn } from "@tanstack/react-start";
import type { Track } from "./types";

/**
 * Discovery feed.
 *
 * Pulls genuinely new music from the YouTube Music songs catalog so the home
 * screen suggests fresh songs and unfamiliar artists on every open, instead of
 * only re-sampling the local public-domain archive.
 *
 * Queries are grouped into rails; results are cached server-side by the shared
 * YouTube Music cache so repeated opens stay cheap.
 */

export interface DiscoveryRail {
  id: string;
  caption: string;
  title: string;
  tracks: Track[];
}

export interface DiscoveryFeed {
  rails: DiscoveryRail[];
  /** Artists seen in the results, for the "New artists" rail. */
  artists: { name: string; artworkUrl?: string | null; sample: Track }[];
  degraded: boolean;
}

const NEW_RELEASE_QUERIES = [
  "new hindi songs 2026",
  "new punjabi songs 2026",
  "new tamil songs 2026",
  "new telugu songs 2026",
  "latest bollywood songs",
  "new indie india songs",
  "new english songs 2026",
  "new malayalam songs 2026",
];

const TRENDING_QUERIES = [
  "trending songs india",
  "top hits this week",
  "top 50 india songs",
  "viral songs right now",
  "trending punjabi hits",
  "bollywood top charts",
];

const FRESH_QUERIES = [
  "fresh finds indie",
  "new artist discovery",
  "underrated new songs",
  "rising artists india",
  "new lofi releases",
  "acoustic new releases",
];

/** Rotate a query list so a different slice is used per session seed. */
function slice(list: string[], seed: number, count: number): string[] {
  const start = Math.abs(seed) % list.length;
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(list[(start + i) % list.length]);
  return out;
}

function dedupeTracks(tracks: Track[], seen: Set<string>): Track[] {
  const out: Track[] = [];
  for (const track of tracks) {
    const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
    if (seen.has(track.id) || seen.has(key)) continue;
    seen.add(track.id);
    seen.add(key);
    out.push(track);
  }
  return out;
}

interface DiscoveryInput {
  seed?: number;
  /** Artists the listener already plays a lot — used to seed personal picks. */
  seedArtists?: string[];
  /** Extra keywords from the active mood chip. */
  mood?: string;
}

export const getDiscoveryFeed = createServerFn({ method: "GET" })
  .inputValidator((input: DiscoveryInput) => ({
    seed: Number.isFinite(Number(input?.seed)) ? Math.abs(Number(input?.seed)) : 1,
    seedArtists: (input?.seedArtists ?? []).slice(0, 4).map((name) => String(name).slice(0, 60)),
    mood: String(input?.mood ?? "").slice(0, 40),
  }))
  .handler(async ({ data }): Promise<DiscoveryFeed> => {
    const { cacheKey, readCache, writeCache, dedupe, youtubeMusicSearch } = await import(
      "./youtube.server"
    );

    const moodSuffix = data.mood && data.mood !== "all" ? ` ${data.mood}` : "";

    const run = async (query: string, limit: number): Promise<Track[]> => {
      const key = `${cacheKey(query, limit)}|music`;
      const cached = readCache(key);
      if (cached) return cached;
      try {
        return await dedupe(key, async () => {
          const songs = await youtubeMusicSearch(query, limit);
          if (songs.length) writeCache(key, songs);
          return songs;
        });
      } catch {
        return [];
      }
    };

    const newQueries = slice(NEW_RELEASE_QUERIES, data.seed, 2).map((q) => q + moodSuffix);
    const trendingQueries = slice(TRENDING_QUERIES, data.seed + 3, 2).map((q) => q + moodSuffix);
    const freshQueries = data.seedArtists.length
      ? data.seedArtists.slice(0, 2).map((artist) => `${artist} similar artists${moodSuffix}`)
      : slice(FRESH_QUERIES, data.seed + 7, 2).map((q) => q + moodSuffix);
    const artistQueries = slice(FRESH_QUERIES, data.seed + 11, 2).map((q) => q + moodSuffix);

    const [newRes, trendRes, freshRes, artistRes] = await Promise.all([
      Promise.all(newQueries.map((q) => run(q, 16))),
      Promise.all(trendingQueries.map((q) => run(q, 16))),
      Promise.all(freshQueries.map((q) => run(q, 16))),
      Promise.all(artistQueries.map((q) => run(q, 16))),
    ]);

    const seen = new Set<string>();
    const rails: DiscoveryRail[] = [];

    const push = (id: string, caption: string, title: string, groups: Track[][]) => {
      const tracks = dedupeTracks(groups.flat(), seen).slice(0, 18);
      if (tracks.length >= 4) rails.push({ id, caption, title, tracks });
    };

    push("discovery-new", "Just added to YouTube Music", "New releases", newRes);
    push("discovery-trending", "Charting right now", "Trending now", trendRes);
    push(
      "discovery-fresh",
      data.seedArtists.length ? "Because you listen to " + data.seedArtists[0] : "Fresh off the catalog",
      "Fresh finds for you",
      freshRes,
    );

    // Artists drawn from a separate discovery pass so the rail isn't just the
    // artists already shown above.
    const artistPool = dedupeTracks(artistRes.flat(), new Set()).filter(
      (track) => track.artist && track.artist.toLowerCase() !== "unknown artist",
    );
    const artistSeen = new Set<string>();
    const artists: DiscoveryFeed["artists"] = [];
    for (const track of artistPool) {
      const key = track.artist.toLowerCase();
      if (artistSeen.has(key)) continue;
      artistSeen.add(key);
      artists.push({ name: track.artist, artworkUrl: track.artworkUrl ?? null, sample: track });
      if (artists.length >= 18) break;
    }

    return { rails, artists, degraded: rails.length === 0 };
  });
