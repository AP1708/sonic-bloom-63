## Goal

After the home feed refreshes, the songs and artists that are actually new should visibly announce themselves — they fade/slide in and carry a short-lived "New" marker — so you can tell at a glance what changed.

## What you'll see

- On each refresh, newly appended cards in the discovery rails (New releases, Trending now, New on Spotify, Fresh finds) animate in with a staggered fade-and-rise instead of just appearing.
- Those cards show a small "New" pill on the artwork that fades away after about 12 seconds (or as soon as the next batch arrives), so the feed doesn't stay permanently decorated.
- The "New artists for you" rail does the same for artists that weren't there before.
- The existing status line ("24 new songs added to your feed") gains a subtle highlight pulse when the count changes.
- Everything is disabled under the system "reduce motion" setting — new items still get the badge, just no movement.

## Technical approach

**1. Track which items are new (`src/lib/music/feed-store.ts`)**
- `mergeBatch` already computes `freshThisBatch`. Add to the store a `freshKeys: Set<string>` (track keys) and `freshArtistKeys: Set<string>` for the most recent batch, plus a `batchId` counter.
- Expose them on `AccumulatedFeed` so the UI can ask "is this card new?" without diffing arrays. First batch (`batches === 1`) reports no fresh keys — the whole feed is new then, so highlighting everything is noise.

**2. Marker lifetime (`src/routes/index.tsx`)**
- A small `useFreshMarkers(batchId, freshKeys)` hook holds the active marker set and clears it via a 12s timer, or immediately when a newer batch merges.

**3. Card rendering**
- `SongCard` (`src/components/music/song-card.tsx`) and `ArtistCard` (`src/components/music/artist-card.tsx`) take an optional `isNew?: boolean` and `index?: number`.
- When `isNew`, the card gets the entrance animation class with an inline `animationDelay` of `Math.min(index, 8) * 40ms` for the stagger, plus a "New" pill positioned over the artwork corner.

**4. Animation tokens (`src/styles.css`)**
- Add a `card-enter` keyframe (opacity 0 → 1, `translateY(8px) scale(0.98)` → rest) and a `fresh-pill` fade-out, exposed as utility classes next to the existing `rise-in`/`equalize` keyframes, using the current accent tokens for the pill (no hardcoded colors).
- Wrap the movement in `@media (prefers-reduced-motion: reduce)` to no-op.

**5. Status line**
- Add a brief highlight transition on the count text keyed to `batchId`.

No backend, query, or data-fetching changes — this is presentation only.
