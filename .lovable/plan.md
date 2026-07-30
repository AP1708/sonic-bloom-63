# Smart download progress & status

Today the Downloads page only shows a one-line text ("Downloading 3/12 · Title"). This adds a real progress bar plus a per-track status for every item in a refresh run.

## What you'll see

- A **progress card** at the top of the smart-downloads panel while a refresh runs: a filled bar (completed / total), the phase label (Planning → Downloading → Tidying up → Done), count, and a Cancel button.
- Each track in the run shows a **status chip**: Queued, Downloading (with its own per-file bar when the server reports a size), Ready, Failed, or Pinned (streaming-only sources such as Spotify/YouTube that can't store audio).
- **Failed** items get a Retry button; the run summary stays visible after finishing so failures aren't lost.
- The existing offline lists get the same chip so a track's state is obvious outside a run.

## Technical details

1. `src/lib/offline/store.ts` — `saveTrack` gains an optional `onBytes(received, total)` callback: read the fetch `Response.body` reader stream instead of `.blob()` so byte-level progress is available; fall back to `.blob()` when the body isn't streamable. Distinguish "no audio URL" (pinned) from "fetch failed" by throwing on failure instead of silently storing a 0-byte entry.
2. `src/lib/offline/smart-downloads.ts` — extend `SmartDownloadProgress` with `items: { id, title, artist, status: 'queued'|'downloading'|'ready'|'failed'|'pinned', received, total }[]`. Emit the full planned list at the end of the planning phase (all `queued`), then update per item as the loop runs. Keep the existing `phase/completed/total` fields so current UI keeps working.
3. `src/hooks/use-offline.ts` — hold the item list in state, keep the last run's result after `phase: 'done'` instead of resetting straight to `idle`, expose `cancelRefresh()` (an `AbortController` passed as `signal`) and `retryItem(id)` that calls `saveTrack(track, 'smart')` for a single failed track.
4. `src/routes/_authenticated/downloads.tsx` — new `DownloadProgressCard` and `StatusChip` components rendering the above; reuse existing `StorageMeter` styling and semantic tokens (no hardcoded colors).

No database or backend changes.