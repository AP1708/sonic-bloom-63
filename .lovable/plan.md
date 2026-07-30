## Goal

Replace the current home screen (greeting + "Jump back in" list + "Quick picks" list + card shelves) with a layout that mirrors the YouTube Music home feed.

## Target layout (top to bottom)

```text
[ mood/genre chip row ]  Energise · Relax · Workout · Focus · Commute · Romance · Party
--------------------------------------------------------------
[ HERO ROW ]  large "Quick picks" hub card + big top-pick artwork
--------------------------------------------------------------
Listen again                              -> horizontal scroll, square cards
Quick picks                               -> 4-row x N-column track grid, horizontal paging
Mixed for you                             -> horizontal scroll, mix cards w/ blurred stack look
Trending Indian songs                     -> horizontal scroll, song cards w/ play overlay
Artists for you                           -> horizontal scroll, ROUND artist avatars
Recommended albums / playlists            -> horizontal scroll, square cards
```

Key YTM traits to reproduce:
- Horizontal snap-scrolling carousels (no wrapping grids) with hover chevrons on desktop.
- Section headers: small caption line above a large title, "More" link on the right.
- The "Quick picks" section is a multi-row track grid that scrolls sideways, one column = 4 stacked track rows.
- Round artist avatars (distinct from square album art).
- Chip row is horizontally scrollable and sticky-ish at the top of the content.
- Existing SONANCE dark tokens/typography kept — no new colors, all semantic tokens.

## What gets built

1. `src/components/music/carousel.tsx` — reusable `Carousel` (snap scroll container + optional left/right arrow buttons) and `SectionHeader` (caption, title, optional "More" link).
2. `src/components/music/chip-row.tsx` — scrollable mood/genre chips; selecting a chip filters the feed (client-side filter over catalog + search results), "All" resets.
3. `src/components/music/song-card.tsx` — square artwork card with hover play overlay, title, artist, source tag (for song/mix/album items).
4. `src/components/music/artist-card.tsx` — round avatar card linking to the existing artist route.
5. `src/components/music/quick-picks-grid.tsx` — the 4-rows-per-column horizontally-paged track grid, reusing `TrackRow` behaviour (play, like, add-to-queue, `TrackMenu`).
6. Rewrite `src/routes/index.tsx` to compose the sections above.

## Data wiring (no backend changes)

- Listen again -> `useRecentlyPlayed` (hidden when empty or signed out).
- Quick picks -> blend of `DEMO_TRACKS`, the Indian archive catalog, and liked songs.
- Mixed for you -> derived mixes from `taste.ts` artist affinity (falls back to catalog genres when there's no history).
- Trending Indian songs -> archive `full-catalog` slice.
- Artists for you -> unique artists from the archive catalog + listening history.
- Recommended albums -> existing `DEMO_COLLECTIONS` / shelves.

All play actions keep going through the existing `usePlayer` (`playTrack`, `playCollection`, `enqueue`), so playback, resolution, and fallback logic are untouched.

## Out of scope

No changes to the player, sidebar, search, downloads, or any server/database code. Head metadata on `/` stays as-is apart from keeping it valid.
