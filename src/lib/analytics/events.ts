import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { MusicSource } from "@/lib/music/types";

/**
 * Usage & diagnostics event tagging.
 *
 * Every search, playback attempt, source fallback and offline download writes a
 * small structured row so we can answer questions like "how often does YouTube
 * Music fall back to the keyless search?" or "why did this track never play?".
 *
 * Rules of the road:
 * - Fire and forget. Nothing here may throw into playback or search paths.
 * - Batched: events are buffered and flushed together to keep writes cheap.
 * - Errors flush immediately, since those are the ones worth troubleshooting.
 * - No-ops when signed out (rows are owned by the listener via RLS).
 */

export type AnalyticsCategory = "search" | "playback" | "fallback" | "offline";

export type AnalyticsStatus = "ok" | "degraded" | "error";

/** Where audio/metadata came from. Wider than MusicSource: includes play paths. */
export type AnalyticsSource =
  | MusicSource
  | "youtube_music"
  | "offline"
  | "preview"
  | "stream"
  | null;

export interface AnalyticsEventInput {
  event: string;
  category: AnalyticsCategory;
  source?: AnalyticsSource;
  trackId?: string | null;
  title?: string | null;
  artist?: string | null;
  query?: string | null;
  status?: AnalyticsStatus;
  reason?: string | null;
  durationMs?: number | null;
  resultCount?: number | null;
  meta?: Record<string, unknown>;
}

interface QueuedRow {
  user_id: string;
  event: string;
  category: AnalyticsCategory;
  source: string | null;
  track_id: string | null;
  title: string | null;
  artist: string | null;
  query: string | null;
  status: AnalyticsStatus;
  reason: string | null;
  duration_ms: number | null;
  result_count: number | null;
  meta: Json;
  client: string;
  created_at: string;
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER = 40;

let currentUserId: string | null = null;
let buffer: QueuedRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Called once the session is known; events before this are dropped. */
export function setAnalyticsUser(userId: string | null) {
  currentUserId = userId;
  if (!userId) buffer = [];
}

function clip(value: string | null | undefined, max = 300): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
}

async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!buffer.length) return;
  const rows = buffer;
  buffer = [];
  try {
    await supabase.from("analytics_events").insert(rows);
  } catch {
    /* analytics must never surface an error to the listener */
  }
}

/** Flushes anything buffered right now (used on page hide / sign-out). */
export function flushAnalytics() {
  void flush();
}

function schedule(immediate: boolean) {
  if (immediate || buffer.length >= MAX_BUFFER) {
    void flush();
    return;
  }
  if (timer) return;
  timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
}

/** Records one event. Safe to call from anywhere, including render paths. */
export function track(input: AnalyticsEventInput) {
  try {
    if (typeof window === "undefined") return;
    const userId = currentUserId;
    if (!userId) return;

    const status = input.status ?? "ok";
    buffer.push({
      user_id: userId,
      event: input.event,
      category: input.category,
      source: input.source ?? null,
      track_id: clip(input.trackId, 200),
      title: clip(input.title),
      artist: clip(input.artist),
      query: clip(input.query, 200),
      status,
      reason: clip(input.reason, 200),
      duration_ms:
        input.durationMs == null ? null : Math.max(0, Math.round(input.durationMs)),
      result_count: input.resultCount == null ? null : Math.round(input.resultCount),
      meta: (input.meta ?? {}) as Json,
      client: "web",
      created_at: new Date().toISOString(),
    });
    schedule(status === "error");
  } catch {
    /* never throw */
  }
}

/** Groups every event emitted while resolving one track's playback source. */
export function newResolveId(): string {
  return Math.random().toString(36).slice(2, 10);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flushAnalytics());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics();
  });
}
