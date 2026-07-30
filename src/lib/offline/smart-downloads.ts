import type { Track } from "@/lib/music/types";
import { track as trackEvent } from "@/lib/analytics/events";
import { loadFullCatalog, artistSlug } from "@/lib/music/full-catalog";
import { findRelatedTracks } from "@/lib/music/related";
import { artistAffinityScore, topArtists, topTracks, type HistoryEntry } from "@/lib/music/taste";
import {
  listOffline,
  pruneTo,
  removeTrack,
  requestPersistence,
  saveTrack,
  type OfflineEntry,
} from "./store";
import { isMeteredConnection, type SmartDownloadSettings } from "./settings";

/**
 * Smart downloads.
 *
 * Builds a target list from what the listener actually plays (history, liked
 * songs, favourite artists), downloads what's missing, and drops auto-added
 * songs that fell out of favour. Manual downloads are never removed here.
 */

export type SmartItemStatus = "queued" | "downloading" | "ready" | "failed" | "pinned";

export interface SmartDownloadItem {
  id: string;
  title: string;
  artist: string;
  /** Kept so the UI can retry a single failed download. */
  track: Track;

  status: SmartItemStatus;
  /** Bytes fetched so far, and the expected total when the server reports one. */
  received: number;
  total: number;
}

export interface SmartDownloadProgress {
  phase: "idle" | "planning" | "downloading" | "pruning" | "done" | "skipped";
  completed: number;
  total: number;
  currentTitle?: string;
  message?: string;
  items?: SmartDownloadItem[];
}


export interface SmartDownloadInput {
  history: HistoryEntry[];
  liked: Track[];
  settings: SmartDownloadSettings;
  onProgress?: (progress: SmartDownloadProgress) => void;
  signal?: AbortSignal;
}

export interface SmartDownloadResult {
  added: number;
  removed: number;
  skipped?: string;
}

/** Rough size guess used to plan a batch before any bytes are fetched. */
const BYTES_PER_SECOND = 128_000 / 8; // 128 kbps mp3
const MAX_PER_RUN = 25;

function estimateBytes(track: Track): number {
  return Math.max(1, track.durationSec || 180) * BYTES_PER_SECOND;
}

/**
 * Ranks candidates by how well they match the listener's taste. Only tracks
 * with a direct stream can actually be stored, so those come first.
 */
function rank(candidates: Track[], history: HistoryEntry[], liked: Track[]): Track[] {
  const affinities = topArtists(history, 12);
  const likedIds = new Set(liked.map((track) => track.id));
  const favouriteIds = new Set(topTracks(history, 40).map((track) => track.id));

  const seen = new Set<string>();
  const scored: { track: Track; score: number }[] = [];
  for (const track of candidates) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    let score = artistAffinityScore(track, affinities) * 10;
    if (likedIds.has(track.id)) score += 60;
    if (favouriteIds.has(track.id)) score += 40;
    if (track.audioUrl) score += 25; // genuinely downloadable
    scored.push({ track, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.track);
}

/** Collects everything worth considering for the offline mix. */
async function buildCandidates(history: HistoryEntry[], liked: Track[]): Promise<Track[]> {
  const candidates: Track[] = [...liked, ...topTracks(history, 40)];
  const affinities = topArtists(history, 6);

  // Favourite artists: pull their catalog entries, which stream directly and
  // therefore can be stored for true offline listening.
  if (affinities.length) {
    try {
      const catalog = await loadFullCatalog();
      for (const affinity of affinities) {
        const bucket = catalog.byArtist.get(artistSlug(affinity.artist));
        if (bucket) candidates.push(...bucket.slice(0, 20));
      }
    } catch {
      /* catalog offline — fall back to the seeds we already have */
    }
  }

  // A little discovery: songs related to the most-played track.
  const seeds = topTracks(history, 2);
  for (const seed of seeds) {
    const related = await findRelatedTracks(
      seed,
      candidates.map((track) => track.id),
      6,
    ).catch(() => [] as Track[]);
    candidates.push(...related);
  }

  return candidates;
}

let running = false;

export async function runSmartDownloads(input: SmartDownloadInput): Promise<SmartDownloadResult> {
  const { history, liked, settings, onProgress, signal } = input;
  const report = (progress: SmartDownloadProgress) => onProgress?.(progress);

  if (running) return { added: 0, removed: 0, skipped: "A refresh is already running." };
  if (!settings.enabled) {
    report({ phase: "skipped", completed: 0, total: 0, message: "Smart downloads are off." });
    return { added: 0, removed: 0, skipped: "Smart downloads are off." };
  }
  if (settings.wifiOnly && isMeteredConnection()) {
    report({ phase: "skipped", completed: 0, total: 0, message: "Waiting for Wi-Fi." });
    return { added: 0, removed: 0, skipped: "Waiting for Wi-Fi." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    report({ phase: "skipped", completed: 0, total: 0, message: "You're offline." });
    return { added: 0, removed: 0, skipped: "You're offline." };
  }
  if (!history.length && !liked.length) {
    report({ phase: "skipped", completed: 0, total: 0, message: "Play a few songs first." });
    return { added: 0, removed: 0, skipped: "Play a few songs first." };
  }

  running = true;
  const startedAt = Date.now();
  trackEvent({ event: "offline.refresh_started", category: "offline" });
  try {
    report({ phase: "planning", completed: 0, total: 0 });
    void requestPersistence();

    const existing: OfflineEntry[] = await listOffline();
    const manualBytes = existing
      .filter((entry) => entry.reason === "manual")
      .reduce((sum, entry) => sum + entry.bytes, 0);
    const budget = Math.max(0, settings.limitBytes - manualBytes);

    const candidates = rank(await buildCandidates(history, liked), history, liked);

    // Fill the budget with the best-matching tracks.
    const target: Track[] = [];
    let planned = 0;
    for (const track of candidates) {
      const size = estimateBytes(track);
      if (planned + size > budget) continue;
      target.push(track);
      planned += size;
      if (target.length >= 120) break;
    }

    const targetIds = new Set(target.map((track) => track.id));
    const storedIds = new Set(existing.map((entry) => entry.id));

    // Retire auto-added tracks that are no longer in the target list.
    let removed = 0;
    for (const entry of existing) {
      if (entry.reason !== "smart" || targetIds.has(entry.id)) continue;
      await removeTrack(entry.id);
      removed += 1;
    }

    const missing = target.filter((track) => !storedIds.has(track.id)).slice(0, MAX_PER_RUN);
    const items: SmartDownloadItem[] = missing.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      track,

      status: "queued",
      received: 0,
      total: track.audioUrl ? Math.round(estimateBytes(track)) : 0,
    }));
    const snapshot = () => items.map((item) => ({ ...item }));

    let added = 0;
    report({ phase: "downloading", completed: 0, total: missing.length, items: snapshot() });
    for (const [index, track] of missing.entries()) {
      if (signal?.aborted) break;
      const item = items[index];
      item.status = "downloading";
      report({
        phase: "downloading",
        completed: added,
        total: missing.length,
        currentTitle: track.title,
        items: snapshot(),
      });
      try {
        let lastReport = 0;
        const entry = await saveTrack(track, "smart", signal, (received, total) => {
          item.received = received;
          if (total) item.total = total;
          const now = Date.now();
          if (now - lastReport < 200) return;
          lastReport = now;
          report({
            phase: "downloading",
            completed: added,
            total: missing.length,
            currentTitle: track.title,
            items: snapshot(),
          });
        });
        item.status = entry.hasAudio ? "ready" : "pinned";
        item.received = entry.bytes;
        if (entry.bytes) item.total = entry.bytes;
        added += 1;
        trackEvent({
          event: entry.hasAudio ? "offline.item_ready" : "offline.pinned",
          category: "offline",
          source: track.source,
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          status: entry.hasAudio ? "ok" : "degraded",
          reason: entry.hasAudio ? null : "metadata_only",
          meta: { bytes: entry.bytes },
        });
      } catch (error) {
        item.status = "failed"; // retried on the next refresh, or by hand
        trackEvent({
          event: "offline.item_failed",
          category: "offline",
          source: track.source,
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          status: "error",
          reason: error instanceof Error ? error.message : "download_failed",
          meta: { bytes: item.received },
        });
      }
      report({
        phase: "downloading",
        completed: added,
        total: missing.length,
        items: snapshot(),
      });
    }

    report({ phase: "pruning", completed: added, total: missing.length, items: snapshot() });
    await pruneTo(settings.limitBytes);

    report({ phase: "done", completed: added, total: missing.length, items: snapshot() });
    trackEvent({
      event: "offline.refresh_completed",
      category: "offline",
      durationMs: Date.now() - startedAt,
      resultCount: added,
      meta: { removed, attempted: missing.length },
    });
    return { added, removed };

  } finally {
    running = false;
  }
}
