## Goal

An offline mix that keeps itself fresh: the app looks at what you've been listening to and which artists you play most, then downloads matching songs in the background so they're available with no connection.

Note on what can actually be stored: only Archive/Indian-catalog tracks have a direct audio stream that can be saved offline. Spotify and YouTube tracks can be pinned (artwork + metadata cached so they appear and queue instantly), but their audio must still stream — their terms don't allow local copies. Smart Downloads will therefore prefer archive tracks for real offline audio and mark the rest as "streaming only".

## 1. Offline store (new foundation — none exists today)

New `src/lib/offline/store.ts` on IndexedDB (`sonance-offline`):

- `tracks` — track metadata + reason (`manual` | `smart`) + timestamps
- `audio` — audio Blobs keyed by track id
- `artwork` — small image Blobs

API: `saveTrack`, `getAudioBlob`, `listOffline`, `removeTrack`, `usageBytes`, `pruneTo(limitBytes)`.

`src/hooks/use-offline.ts` exposes the list, per-track download state, and totals; the player checks the store first and plays a blob URL when present, so downloaded songs work with no network.

## 2. Listening history

`recently_played` already exists but is capped and unweighted. Add a `listening_history` table (user, track metadata, played_at, seconds_played, completed) written by the existing play-tracking path in `player-provider.tsx`.

Derive an artist affinity score: recent plays weigh more (time decay), completed plays more than skips. Exposed via `src/lib/music/taste.ts` as `topArtists()` and `topTracks()`.

## 3. Smart Downloads engine

`src/lib/offline/smart-downloads.ts`:

1. Build a target list: recent favourites + liked songs + top-artist tracks pulled through the existing `findRelatedTracks` / `searchAll` abstraction.
2. Rank by affinity, keep the top N that fit the storage budget, preferring downloadable archive tracks.
3. Diff against what's already stored: download what's new, delete smart items that fell out of the list (manual downloads are never auto-deleted).
4. Run on app start (if stale > 12h), on reconnect, and via a manual "Refresh now" — always de-bounced, and it defers when the browser reports a metered/save-data connection.

Downloads run sequentially with progress, and failures are silent retries next cycle.

## 4. UI

- New route `/downloads`: storage meter, "Smart mix" section (auto-managed) and "Your downloads" (manual), each row with a remove action and an offline badge.
- Settings block on the same page: enable Smart Downloads, storage limit slider (500 MB / 1 GB / 2 GB / custom), Wi-Fi-only toggle, refresh frequency.
- Download / Remove download action added to the existing `TrackMenu`, plus an offline indicator in `TrackRow` and the player bar.
- Sidebar link with a small "offline ready" count.

## Technical notes

- Schema change: one new table with RLS scoped to `auth.uid()` and grants for `authenticated`.
- Playback: `resolve-playback.ts` gains an offline-first branch before any provider resolution.
- Storage safety: request `navigator.storage.persist()`, respect `estimate()` quota, prune oldest smart items first.
- No copyrighted audio is ever stored — only public-domain archive streams; Spotify/YouTube entries stay metadata-only.
