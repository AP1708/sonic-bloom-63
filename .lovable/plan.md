## Goal

Every time you open (or return to) the app, the home discovery rails pull a fresh batch from YouTube Music, and new song recommendations are **added** to the feed rather than swapping the whole thing out.

## Current behaviour

- `src/lib/music/feed-seed.ts` stores one seed per browser session in `sessionStorage`. A reopened PWA/tab keeps the same tab session, so the seed — and therefore the rails — stay identical.
- `src/routes/index.tsx` fetches discovery with a 5-minute `staleTime` and renders exactly the three returned rails; nothing accumulates over time.

## Changes

### 1. Seed rotates per app open

Rework `feed-seed.ts`:
- Store the seed plus a `lastOpenedAt` timestamp in `localStorage` (so it survives reload/PWA restart).
- Mint a **new** seed when the app opens cold, or when the page becomes visible again after being backgrounded longer than a threshold (~20 minutes).
- Expose `useFeedSeed()`: returns the current seed and re-renders subscribers when it rotates, wiring a `visibilitychange` listener so returning to the app rotates without a manual reload.

### 2. Background refresh of discovery

In the home route:
- Key the discovery query on the live seed, with `refetchOnWindowFocus`, `refetchOnMount: "always"`, and a short `staleTime` so a rotation triggers a real fetch.
- Keep the previously shown rails visible while the new batch loads (`placeholderData` keep-previous), with a subtle "Refreshing picks" indicator instead of a skeleton flash.

### 3. Accumulate new recommendations

Add a small accumulator (`src/lib/music/feed-store.ts`):
- Holds recommendations already shown this session, keyed by rail id, deduped by track id and title|artist.
- Each discovery response merges in: **new tracks are prepended** to their rail, previously seen ones remain further along, so the rail grows instead of resetting.
- Cap each rail (~40 tracks) and the total pool so memory stays bounded.
- Genuinely new batches also spawn an extra "Fresh for you · just now" rail at the top of the infinite-scroll extras, and any newly discovered artists get appended to the "New artists for you" avatar rail.

### 4. Manual refresh

Add a small refresh control on the discovery section header that rotates the seed and refetches on demand.

## Technical notes

- Seed rotation logic lives in `feed-seed.ts` and is read via a hook so `HomePage` stays declarative; SSR keeps returning a fixed seed to avoid hydration mismatch, with rotation applied after mount.
- Accumulation happens client-side; `discovery.functions.ts` stays unchanged, still hitting the cached `youtubeMusicSearch` path so extra opens do not multiply upstream quota usage.
- Files touched: `src/lib/music/feed-seed.ts`, new `src/lib/music/feed-store.ts`, `src/routes/index.tsx`.
