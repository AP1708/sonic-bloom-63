import { track as trackEvent } from "@/lib/analytics/events";
import { DEMO_TRACKS } from "./catalog";
import { loadFullCatalog, searchFullCatalog } from "./full-catalog";
import { searchYouTube } from "./youtube.functions";
import { searchSpotify } from "./spotify.functions";
import type { MusicSource, SearchOptions, SearchResults, Track } from "./types";


/**
 * API abstraction layer.
 *
 * Each source implements the same `MusicProvider` contract. Real credentials
 * are optional: when a provider has no key configured it reports itself as
 * unavailable and `searchAll` degrades gracefully instead of throwing, so the
 * UI keeps working while integrations are being connected.
 *
 * Compliance notes:
 * - Only official APIs are used (Spotify Web API, YouTube Data API v3).
 * - We cache metadata only. No copyrighted media is downloaded or stored.
 * - Playback happens in the official embedded players; every track keeps an
 *   `externalUrl` back to the source platform for attribution.
 */

export interface ProviderSearchMeta {
  /** Which internal path served the results (YouTube Music only, for now). */
  strategy?: string;
  /** Why the result set is empty or degraded. */
  reason?: string;
}

export interface MusicProvider {
  id: MusicSource;
  label: string;
  isConfigured(): boolean;
  search(query: string, options?: SearchOptions): Promise<Track[]>;
  /** Optional richer variant used for analytics tagging. */
  searchWithMeta?(
    query: string,
    options?: SearchOptions,
  ): Promise<{ tracks: Track[] } & ProviderSearchMeta>;
}


function matches(track: Track, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    track.title.toLowerCase().includes(q) ||
    track.artist.toLowerCase().includes(q) ||
    (track.album ?? "").toLowerCase().includes(q)
  );
}

function demoSearch(source: MusicSource, query: string, limit: number): Track[] {
  return DEMO_TRACKS.filter((t) => t.source === source && matches(t, query)).slice(0, limit);
}

export const spotifyProvider: MusicProvider = {
  id: "spotify",
  label: "Spotify",
  // Credentials live server-side; the server function reports if they are missing.
  isConfigured: () => true,
  async search(query, options = {}) {
    const limit = options.limit ?? 20;
    return searchSpotify({ data: { query, limit } });
  },
};

export const youtubeProvider: MusicProvider = {
  id: "youtube",
  label: "YouTube Music",
  // The API key lives server-side; the server function reports if it is missing.
  isConfigured: () => true,
  async search(query, options = {}) {
    const limit = options.limit ?? 20;
    const result = await searchYouTube({ data: { query, limit } });
    return result.tracks;
  },
  async searchWithMeta(query, options = {}) {
    const limit = options.limit ?? 20;
    const result = await searchYouTube({ data: { query, limit } });
    return { tracks: result.tracks, strategy: result.strategy, reason: result.reason };
  },
};


/** Public-domain recordings streamed from the Internet Archive. Always available. */
export const archiveProvider: MusicProvider = {
  id: "archive",
  label: "Archive",
  isConfigured: () => true,
  async search(query, options = {}) {
    const limit = options.limit ?? 20;
    try {
      const catalog = await loadFullCatalog();
      return searchFullCatalog(catalog, query, limit);
    } catch {
      // Full archive unavailable (offline) — fall back to the bundled featured set.
      return demoSearch("archive", query, limit);
    }
  },
};

export const PROVIDERS: MusicProvider[] = [archiveProvider, spotifyProvider, youtubeProvider];

export async function searchAll(query: string, options: SearchOptions = {}): Promise<SearchResults> {
  const source = options.source ?? "all";
  const active = source === "all" ? PROVIDERS : PROVIDERS.filter((p) => p.id === source);

  trackEvent({ event: "search.started", category: "search", query, meta: { source } });
  const startedAll = Date.now();

  const settled = await Promise.allSettled(
    active.map(async (provider) => {
      const started = Date.now();
      try {
        const result = provider.searchWithMeta
          ? await provider.searchWithMeta(query, options)
          : { tracks: await provider.search(query, options) };
        trackEvent({
          event: result.tracks.length ? "search.completed" : "search.empty",
          category: "search",
          source: provider.id,
          query,
          status: result.tracks.length ? "ok" : "degraded",
          reason: result.reason ?? null,
          durationMs: Date.now() - started,
          resultCount: result.tracks.length,
          meta: { strategy: result.strategy ?? null },
        });
        return result.tracks;
      } catch (error) {
        trackEvent({
          event: "search.failed",
          category: "search",
          source: provider.id,
          query,
          status: "error",
          reason: error instanceof Error ? error.message : "unknown_error",
          durationMs: Date.now() - started,
        });
        throw error;
      }
    }),
  );

  const tracks: Track[] = [];
  const degraded: SearchResults["degraded"] = [];

  settled.forEach((result, index) => {
    const provider = active[index];
    if (result.status === "fulfilled") {
      tracks.push(...result.value);
    } else {
      degraded.push({
        source: provider.id,
        reason: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
    }
  });

  trackEvent({
    event: "search.finished",
    category: "search",
    query,
    status: degraded.length ? "degraded" : "ok",
    durationMs: Date.now() - startedAll,
    resultCount: tracks.length,
    meta: { source, degraded: degraded.map((item) => item.source) },
  });


  // Interleave sources so neither platform dominates the top of the results.
  const bySource = new Map<MusicSource, Track[]>();
  for (const track of tracks) {
    const bucket = bySource.get(track.source) ?? [];
    bucket.push(track);
    bySource.set(track.source, bucket);
  }
  const interleaved: Track[] = [];
  let cursor = 0;
  let added = true;
  while (added) {
    added = false;
    for (const bucket of bySource.values()) {
      if (bucket[cursor]) {
        interleaved.push(bucket[cursor]);
        added = true;
      }
    }
    cursor += 1;
  }

  return { tracks: interleaved, degraded };
}
