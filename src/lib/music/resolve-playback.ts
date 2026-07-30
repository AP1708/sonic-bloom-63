import { searchYouTube } from "./youtube.functions";
import { searchSpotify } from "./spotify.functions";
import { track as trackEvent } from "@/lib/analytics/events";
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


const NOISE = [
  "official",
  "video",
  "audio",
  "lyrics",
  "lyric",
  "hd",
  "hq",
  "4k",
  "remaster",
  "remastered",
  "full",
  "song",
  "mp3",
  "with",
  "feat",
  "ft",
];

/** Terms that usually indicate a different recording than the requested track. */
const BAD_TERMS = [
  "cover",
  "karaoke",
  "instrumental",
  "reaction",
  "review",
  "remix",
  "mashup",
  "live",
  "concert",
  "slowed",
  "reverb",
  "speed up",
  "sped up",
  "8d",
  "nightcore",
  "tutorial",
  "guitar lesson",
  "ringtone",
  "jukebox",
  "mix",
  "medley",
  "full album",
  "trailer",
  "teaser",
  "shorts",
];

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\(\[][^\)\]]*[\)\]]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalise(value)
    .split(" ")
    .filter((word) => word.length > 2 && !NOISE.includes(word));
}

function coverage(want: string[], haystack: string): number {
  if (!want.length) return 0;
  const hits = want.filter((word) => haystack.includes(word)).length;
  return hits / want.length;
}

/**
 * Ranks a YouTube candidate against the wanted track.
 * Returns a score; negative means "definitely not this song".
 */
function scoreCandidate(track: Track, candidate: Track): number {
  const raw = `${candidate.title} ${candidate.artist}`.toLowerCase();
  const hay = `${normalise(candidate.title)} ${normalise(candidate.artist)}`;
  const titleWords = tokens(track.title);
  const artistWords = tokens(track.artist);

  const titleScore = coverage(titleWords, hay);
  // A weak title match is disqualifying — this is what causes wrong-video playback.
  if (titleScore < 0.6) return -1;

  let score = titleScore * 100;
  score += coverage(artistWords, hay) * 60;

  // Official artist channels ("<Artist> - Topic", label uploads) are the safest bet.
  if (/-\s*topic$/i.test(candidate.artist)) score += 25;
  if (/official/i.test(raw)) score += 8;

  // Penalise re-interpretations unless the wanted track advertises the same thing.
  const wantRaw = `${track.title} ${track.artist}`.toLowerCase();
  for (const term of BAD_TERMS) {
    if (raw.includes(term) && !wantRaw.includes(term)) score -= 40;
  }

  // Duration proximity is the strongest signal that it is the same recording.
  if (track.durationSec > 30 && candidate.durationSec > 0) {
    const delta = Math.abs(track.durationSec - candidate.durationSec);
    if (delta <= 5) score += 45;
    else if (delta <= 15) score += 25;
    else if (delta <= 30) score += 5;
    else if (delta > 90) score -= 60;
  }

  return score;
}

/** Loose check that the hit is plausibly the same song (used for Spotify matches). */
function matches(track: Track, candidate: Track): boolean {
  return scoreCandidate(track, candidate) > 0;
}

/** Clean song metadata for a track, taken from its YouTube Music match when there is one. */
const musicMetaCache = new Map<string, { title: string; artist: string; durationSec: number } | null>();

export async function resolveMusicMetadata(
  track: Track,
): Promise<{ title: string; artist: string; durationSec: number }> {
  const fallback = { title: track.title, artist: track.artist, durationSec: track.durationSec };
  // Already a YouTube Music entry, or a direct-stream archive recording.
  if (track.youtubeVideoId || track.audioUrl) return fallback;
  try {
    await resolveYouTubeVideoId(track);
  } catch {
    return fallback;
  }
  return musicMetaCache.get(track.id) ?? fallback;
}

export async function resolveYouTubeVideoId(
  track: Track,
  resolveId?: string,
): Promise<string | null> {
  if (track.youtubeVideoId) return track.youtubeVideoId;
  const key = track.id;
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const tag = (event: string, extra: Record<string, unknown> = {}, reason?: string) =>
    trackEvent({
      event,
      category: "fallback",
      source: "youtube",
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      status: reason ? "degraded" : "ok",
      reason: reason ?? null,
      meta: { resolveId: resolveId ?? null, from: track.source, to: "youtube", ...extra },
    });

  const promise = (async () => {
    const started = Date.now();
    try {
      const base = `${track.artist} ${track.title}`.replace(/\s+/g, " ").trim();
      const pick = (results: Track[], minScore: number) => {
        let best: { track: Track; score: number } | null = null;
        for (const item of results) {
          if (!item.youtubeVideoId) continue;
          const score = scoreCandidate(track, item);
          if (score <= minScore) continue;
          if (!best || score > best.score) best = { track: item, score };
        }
        return best?.track ?? null;
      };

      // Pass 1: the YouTube Music songs catalog — already song-scoped, so the
      // plain "artist title" query is the right one (no "official audio" noise).
      const music = await searchYouTube({ data: { query: base, limit: 10, musicOnly: true } });
      let match = pick(music.tracks, 0) ?? pick(music.tracks, -1);
      let pass = "ytm";

      // Pass 2: only when the Music catalog has nothing — fall back to the
      // general search (video uploads included) so playback still works.
      if (!match) {
        tag("fallback.attempt", { strategy: music.strategy, pass }, "ytm_pass_failed");
        const relaxed = await searchYouTube({ data: { query: base, limit: 10 } });
        match =
          pick(relaxed.tracks, 0) ??
          pick(relaxed.tracks, -1) ??
          relaxed.tracks.find((item) => item.youtubeVideoId) ??
          null;
        pass = "relaxed";
        if (!match) {
          tag(
            "fallback.exhausted",
            { strategy: relaxed.strategy, pass, durationMs: Date.now() - started },
            relaxed.tracks.length ? "no_match" : (relaxed.reason ?? "no_results"),
          );
        }
      }

      const videoId = match?.youtubeVideoId ?? null;
      if (match) {
        musicMetaCache.set(track.id, {
          title: match.title || track.title,
          artist: match.artist || track.artist,
          durationSec: match.durationSec || track.durationSec,
        });
        tag("fallback.matched", {
          strategy: music.strategy,
          pass,
          videoId,
          durationMs: Date.now() - started,
        });
      } else {
        musicMetaCache.set(track.id, null);
      }

      cache.set(key, videoId);
      return videoId;
    } catch (error) {
      tag(
        "fallback.failed",
        { durationMs: Date.now() - started },
        error instanceof Error ? error.message : "lookup_failed",
      );
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
export async function resolveSpotifyUri(
  track: Track,
  resolveId?: string,
): Promise<string | null> {
  if (track.spotifyUri) return track.spotifyUri;
  const key = track.id;
  if (spotifyCache.has(key)) return spotifyCache.get(key) ?? null;
  const existing = spotifyInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const started = Date.now();
    try {
      const results = await searchSpotify({
        data: { query: `${track.artist} ${track.title}`.trim(), limit: 5 },
      });
      const hit = results.find((item) => matches(track, item)) ?? null;
      const uri = hit?.spotifyUri ?? null;
      trackEvent({
        event: uri ? "fallback.matched" : "fallback.exhausted",
        category: "fallback",
        source: "spotify",
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        status: uri ? "ok" : "degraded",
        reason: uri ? null : results.length ? "no_match" : "no_results",
        durationMs: Date.now() - started,
        meta: { resolveId: resolveId ?? null, from: track.source, to: "spotify" },
      });
      spotifyCache.set(key, uri);
      return uri;
    } catch (error) {
      trackEvent({
        event: "fallback.failed",
        category: "fallback",
        source: "spotify",
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        status: "error",
        reason: error instanceof Error ? error.message : "lookup_failed",
        durationMs: Date.now() - started,
        meta: { resolveId: resolveId ?? null, from: track.source, to: "spotify" },
      });
      spotifyCache.set(key, null);
      return null;
    } finally {
      spotifyInFlight.delete(key);
    }
  })();


  spotifyInFlight.set(key, promise);
  return promise;
}
