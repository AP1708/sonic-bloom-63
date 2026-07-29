import { searchYouTube } from "./youtube.functions";
import { searchSpotify } from "./spotify.functions";
import type { Track } from "./types";

/**
 * Cross-source playback resolution.
 *
 * Every track carries metadata from one platform but should be playable on
 * both: we look up a matching YouTube video (official IFrame player) and a
 * matching Spotify track URI (Web Playback SDK, Premium sessions) so the
 * player can use whichever source is available. Results are memoised per
 * track for the session.
 */

const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

const spotifyCache = new Map<string, string | null>();
const spotifyInFlight = new Map<string, Promise<string | null>>();


function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\(\[][^\)\]]*[\)\]]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose check that the YouTube hit is actually the same song. */
function matches(track: Track, candidate: Track): boolean {
  const wantTitle = normalise(track.title);
  const gotText = `${normalise(candidate.title)} ${normalise(candidate.artist)}`;
  if (!wantTitle) return false;
  const words = wantTitle.split(" ").filter((w) => w.length > 2);
  if (!words.length) return gotText.includes(wantTitle);
  const hits = words.filter((word) => gotText.includes(word)).length;
  return hits / words.length >= 0.6;
}

export async function resolveYouTubeVideoId(track: Track): Promise<string | null> {
  if (track.youtubeVideoId) return track.youtubeVideoId;
  const key = track.id;
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const results = await searchYouTube({
        data: { query: `${track.artist} ${track.title}`.trim(), limit: 5 },
      });
      const hit = results.find((item) => matches(track, item)) ?? results[0] ?? null;
      const videoId = hit?.youtubeVideoId ?? null;
      cache.set(key, videoId);
      return videoId;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Finds a Spotify track URI for a track that came from another source. */
export async function resolveSpotifyUri(track: Track): Promise<string | null> {
  if (track.spotifyUri) return track.spotifyUri;
  const key = track.id;
  if (spotifyCache.has(key)) return spotifyCache.get(key) ?? null;
  const existing = spotifyInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const results = await searchSpotify({
        data: { query: `${track.artist} ${track.title}`.trim(), limit: 5 },
      });
      const hit = results.find((item) => matches(track, item)) ?? null;
      const uri = hit?.spotifyUri ?? null;
      spotifyCache.set(key, uri);
      return uri;
    } catch {
      spotifyCache.set(key, null);
      return null;
    } finally {
      spotifyInFlight.delete(key);
    }
  })();

  spotifyInFlight.set(key, promise);
  return promise;
}
