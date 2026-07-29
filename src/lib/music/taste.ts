import type { Track } from "./types";
import { primaryArtist } from "./related";

/**
 * Taste model.
 *
 * Turns raw listening history into artist / track affinity scores. Recent plays
 * count for more than old ones, and finishing a song counts for more than
 * skipping it a few seconds in.
 */

export interface HistoryEntry {
  track: Track;
  playedAt: number;
  secondsPlayed: number;
  completed: boolean;
}

export interface ArtistAffinity {
  artist: string;
  score: number;
  plays: number;
}

const HALF_LIFE_DAYS = 14;

function recencyWeight(playedAt: number, now: number): number {
  const days = Math.max(0, (now - playedAt) / 86_400_000);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/** 0.2 for an instant skip, up to ~1.2 for a completed listen. */
function completionWeight(entry: HistoryEntry): number {
  if (entry.completed) return 1.2;
  const duration = entry.track.durationSec || 0;
  if (!duration) return entry.secondsPlayed > 30 ? 0.8 : 0.3;
  const ratio = Math.min(1, entry.secondsPlayed / duration);
  return 0.2 + ratio;
}

export function topArtists(history: HistoryEntry[], limit = 8): ArtistAffinity[] {
  const now = Date.now();
  const scores = new Map<string, ArtistAffinity>();
  for (const entry of history) {
    const artist = primaryArtist(entry.track.artist).trim();
    if (!artist) continue;
    const key = artist.toLowerCase();
    const weight = recencyWeight(entry.playedAt, now) * completionWeight(entry);
    const found = scores.get(key);
    if (found) {
      found.score += weight;
      found.plays += 1;
    } else {
      scores.set(key, { artist, score: weight, plays: 1 });
    }
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function topTracks(history: HistoryEntry[], limit = 25): Track[] {
  const now = Date.now();
  const scores = new Map<string, { track: Track; score: number }>();
  for (const entry of history) {
    const weight = recencyWeight(entry.playedAt, now) * completionWeight(entry);
    const found = scores.get(entry.track.id);
    if (found) found.score += weight;
    else scores.set(entry.track.id, { track: entry.track, score: weight });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.track);
}

/** How strongly a candidate track matches the listener's favourite artists. */
export function artistAffinityScore(track: Track, affinities: ArtistAffinity[]): number {
  const artist = primaryArtist(track.artist).trim().toLowerCase();
  if (!artist) return 0;
  const match = affinities.find(
    (item) =>
      item.artist.toLowerCase() === artist ||
      artist.includes(item.artist.toLowerCase()) ||
      item.artist.toLowerCase().includes(artist),
  );
  return match ? match.score : 0;
}
