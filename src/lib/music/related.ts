import { searchAll } from "./providers";
import type { Track } from "./types";

/**
 * Radio / autoplay helper.
 *
 * Given the track that is playing, find songs a listener is likely to want
 * next: first more from the same artist, then songs that share words with the
 * title. Everything runs through the normal `searchAll` abstraction so it
 * inherits provider fallbacks, caching and key rotation.
 */

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "in",
  "on",
  "to",
  "for",
  "with",
  "from",
  "feat",
  "featuring",
  "official",
  "video",
  "audio",
  "song",
  "lyrical",
  "full",
  "hd",
  "remastered",
  "live",
  "version",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywords(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Primary artist only — "A, B & C" and "A feat. B" both collapse to "A". */
export function primaryArtist(artist: string): string {
  return artist
    .split(/,|&|feat\.?|ft\.?|with|x /i)[0]
    .trim();
}

function score(candidate: Track, seed: Track): number {
  const seedArtist = normalize(primaryArtist(seed.artist));
  const candidateArtist = normalize(primaryArtist(candidate.artist));
  let value = 0;

  if (candidateArtist && candidateArtist === seedArtist) value += 100;
  else if (candidateArtist && seedArtist && (candidateArtist.includes(seedArtist) || seedArtist.includes(candidateArtist)))
    value += 60;

  const seedWords = new Set(keywords(seed.title));
  const shared = keywords(candidate.title).filter((word) => seedWords.has(word)).length;
  value += shared * 8;

  // An identical title is usually a duplicate upload, not a good "next" track.
  if (normalize(candidate.title) === normalize(seed.title)) value -= 70;

  // Directly streamable sources start instantly, so nudge them up.
  if (candidate.source === seed.source) value += 10;
  if (candidate.source === "archive") value += 6;

  if (candidate.durationSec > 0 && Math.abs(candidate.durationSec - seed.durationSec) < 90) value += 4;

  return value;
}

async function safeSearch(query: string, limit: number, musicOnly = false): Promise<Track[]> {
  try {
    const results = await searchAll(query, { limit, musicOnly });
    return results.tracks;
  } catch {
    return [];
  }
}

/**
 * Finds songs related to `seed`, skipping anything whose id is in `exclude`.
 * Never throws — an empty array simply means the queue doesn't grow.
 */
export async function findRelatedTracks(
  seed: Track,
  exclude: Iterable<string> = [],
  limit = 8,
  options: { musicOnly?: boolean } = {},
): Promise<Track[]> {
  const artist = primaryArtist(seed.artist);
  const titleWords = keywords(seed.title).slice(0, 3).join(" ");

  const queries = [artist, titleWords ? `${titleWords} ${artist}` : "", titleWords]
    .map((query) => query.trim())
    .filter((query, index, all) => query.length > 1 && all.indexOf(query) === index);

  if (!queries.length) return [];

  const batches = await Promise.all(queries.map((query) => safeSearch(query, 20, options.musicOnly ?? false)));

  const skip = new Set(exclude);
  skip.add(seed.id);

  const seen = new Set<string>();
  const candidates: Track[] = [];
  for (const batch of batches) {
    for (const track of batch) {
      if (skip.has(track.id) || seen.has(track.id)) continue;
      // Different providers can surface the same recording; de-dupe on the pair too.
      const fingerprint = `${normalize(track.title)}::${normalize(primaryArtist(track.artist))}`;
      if (seen.has(fingerprint)) continue;
      seen.add(track.id);
      seen.add(fingerprint);
      candidates.push(track);
    }
  }

  return candidates
    .map((track) => ({ track, value: score(track, seed) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((entry) => entry.track);
}
