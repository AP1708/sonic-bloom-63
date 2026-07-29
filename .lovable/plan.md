## Goal

Remember how far you got in each track in your account, and when you reopen the app, bring back the last track you were listening to — loaded at that saved point, paused and ready to press play.

## Behaviour

- While a track plays, its position is saved to your account (throttled to roughly every 5 seconds, plus on pause, track change, and when the tab closes).
- Finished tracks are cleared, so a completed song starts fresh next time.
- Starting a track yourself (from search, a playlist, an artist page) always begins at 0:00 — saved positions are only used for the restore-on-reopen flow, per your choice.
- On reopening the app while signed in, the player bar and fullscreen player show the last track at its saved position, paused. No autoplay.
- Positions under ~10 seconds or within ~15 seconds of the end are not restored (they just start from 0:00).
- Signed out, nothing is saved or restored.

## Technical details

**Database (one migration)**
- New table `public.playback_positions`: `user_id` + `track_id` (composite primary key), `source`, `title`, `artist`, `artwork_url`, `duration_sec`, `position_sec`, `is_last` handled instead via `updated_at timestamptz`.
- Owner-only RLS (`auth.uid() = user_id`) for select/insert/update/delete, plus `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role` in the same migration.
- The most recent row (`order by updated_at desc limit 1`) is the "last listened" track to restore — no extra column needed.

**Hooks (`src/hooks/use-library.ts`)**
- `savePlaybackPosition(userId, track, positionSec)` — upsert on `(user_id, track_id)`.
- `clearPlaybackPosition(userId, trackId)` — delete on completion.
- `useLastPlaybackPosition(userId)` — query for the newest row, mapped to a `Track` via the existing `rowToTrack`-style mapper.

**Player (`src/components/player/player-provider.tsx`)**
- Save effect: throttled write driven by `state.progressSec` (write at most every 5s), plus a flush on track change, on pause, and on `visibilitychange`/`pagehide`.
- Clear on `handleEnded` for the finished track.
- New `restoreLast()` internal step that runs once after the session loads and only when the queue is empty: sets `queue: [track]`, `index: 0`, `current: track`, `progressSec: savedPosition`, `isPlaying: false`.
- Existing source-resolution effects already key off `state.current`, so the resolved stream/YouTube/Spotify source seeks to `progressSec` on first play rather than starting at 0 — the seek is applied in the audio `onLoadedMetadata` / YouTube ready handlers, guarded so it only happens once per restored track.

**UI**
- No new controls needed; `player-bar.tsx` and `fullscreen-player.tsx` already render `player.current` and `player.progressSec`, so the restored track appears automatically with the progress bar pre-positioned.
