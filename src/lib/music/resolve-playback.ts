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

export async function resolveYouTubeVideoId(track: Track): Promise<string | null> {
  if (track.youtubeVideoId) return track.youtubeVideoId;
  const key = track.id;
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
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
        return best?.track.youtubeVideoId ?? null;
      };

      // Pass 1: strict — prefer official audio uploads that match closely.
      const strict = await searchYouTube({ data: { query: `${base} official audio`, limit: 10 } });
      let videoId = pick(strict, 0);

      // Pass 2: plain query, relaxed threshold — a playable near-match beats silence.
      if (!videoId) {
        const relaxed = await searchYouTube({ data: { query: base, limit: 10 } });
        videoId =
          pick(relaxed, 0) ??
          pick(relaxed, -1) ??
          pick(strict, -1) ??
          relaxed.find((item) => item.youtubeVideoId)?.youtubeVideoId ??
          null;
      }

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
