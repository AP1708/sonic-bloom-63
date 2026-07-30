## Goal

Record structured usage/diagnostic events (searches, playback, source fallbacks, offline downloads) into your own database so you can query why a track fell back from YouTube Music to another source.

## 1. Database

New table `analytics_events`:
- `user_id` (nullable — anonymous/server events allowed), `event` (text, e.g. `search.completed`), `category` (`search` | `playback` | `fallback` | `offline`), `source` (`youtube_music` | `spotify` | `archive` | `offline` | null), `track_id`, `title`, `artist`, `query`, `status` (`ok` | `degraded` | `error`), `reason` (e.g. `quota_429`, `no_match`, `stream_error`), `duration_ms` (latency), `result_count`, `meta` (jsonb for anything else), `client` (`web`), `created_at`.

Access rules:
- Users can insert their own rows and read only their own rows.
- Admins can read all rows (via the existing role check).
- Indexes on created_at, category, event, source, user_id.

## 2. Event pipeline

- `src/lib/analytics/events.ts` — typed event names/payloads plus a `track(event)` client helper that buffers events and flushes in batches (every ~5s, on page hide, and immediately for error events), fails silently, and no-ops when signed out unless anonymous logging is on.
- `src/lib/analytics/analytics.functions.ts` — `logEvents` server fn (authenticated, batched insert) so writes are validated server-side.
- Server-side search path (`youtube.functions.ts` / `youtube.server.ts`) also records which strategy served the request — it already knows about the music.youtube.com path, keyless web search, Data API keys, and cache hits — returning the strategy in the response so the client tags it without a second round trip.

## 3. Instrumentation points

Search (`providers.ts`, `youtube.functions.ts`, `search.tsx`)
- `search.started`, `search.completed` (per provider: latency, result count, strategy used: `ytm_innertube` / `keyless_web` / `data_api` / `cache`), `search.failed` (with `quota_429` etc.), `search.empty`.

Playback (`player-provider.tsx`, `resolve-playback.ts`)
- `playback.resolve_started`, `playback.resolved` (chosen source + match score + latency), `playback.started`, `playback.buffering` (watchdog fires), `playback.unavailable`, `playback.auto_skipped`, `playback.completed`, `playback.seek`, `playback.error`.

Fallback chain (`resolve-playback.ts`, player error handlers)
- `fallback.attempt` with `from_source` → `to_source` and `reason` (`quota_429`, `no_match`, `preview_only`, `sdk_unavailable`, `stream_error`, `strict_pass_failed`), so a full attempt chain is reconstructable per track via a shared `resolve_id` in `meta`.

Offline (`smart-downloads.ts`, `store.ts`)
- `offline.refresh_started/completed`, `offline.item_ready`, `offline.item_failed` (reason + bytes), `offline.pinned`, `offline.play_from_cache`.

## 4. Admin insights view

New **Insights** tab in the existing admin console:
- Range selector (24h / 7d / 30d).
- Cards: searches, playback starts, playback failure rate, offline hit rate.
- Search source breakdown (which strategy served results, cache hit rate, 429 count).
- Fallback table: from → to, reason, count — the main troubleshooting view.
- Recent errors list (event, reason, track, time).
Backed by an admin-only server fn doing aggregate queries.

## Technical notes

- Batched inserts keep write volume low; events are best-effort and never block playback or search.
- Retention: nothing auto-deletes yet; a cleanup job can be added later if volume grows.
