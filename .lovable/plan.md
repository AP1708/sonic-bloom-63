## Goal

Make the home feed feel like YouTube Music end to end, and make it genuinely fresh: new song suggestions every time you open the app, plus discovery rails for new songs and new artists — not just re-shuffled archive tracks.

## Current state (verified)

`src/routes/index.tsx` already has YTM-style pieces (mood chips, hero, Quick picks grid, carousels, round artist cards, infinite scroll). But every rail is sampled deterministically from the local public-domain archive catalog (`full-catalog.ts` / `DEMO_TRACKS`) with fixed offsets, so the feed looks identical on every open and contains no genuinely new music. YouTube Music search (`youtube.functions.ts`, `musicOnly`) is only used for playback resolution and lyrics, never for discovery.

## What to build

### 1. Fresh-on-every-open rotation
- Add `src/lib/music/feed-seed.ts`: a per-session seed (rotates each app open, stored in `sessionStorage`) plus a seeded shuffle helper.
- Replace the fixed `sample(pool, n, offset)` offsets with seeded picks so hero, Quick picks, Trending and Deep cuts differ every session while staying stable during that session (no reshuffle on re-render).

### 2. Live discovery from YouTube Music
- New `src/lib/music/discovery.functions.ts` server function `getDiscoveryFeed`, calling the existing YTM `musicOnly` search with a rotating set of discovery queries (new Hindi/Punjabi/Tamil/Telugu releases, "new songs 2026", trending India, plus taste-seeded queries from the user's top artists), de-duplicating by track id.
- Returns grouped rails: **New releases**, **Trending now**, **Fresh finds for you**, and **New artists** (artists extracted from the returned tracks that aren't in listening history or the local catalog).
- Server-side cached like the existing YTM helpers (short TTL, e.g. 15–30 min, keyed by query set) so quota is protected; the per-session seed picks a different query slice each open.

### 3. Feed wiring
- Home fetches discovery via TanStack Query (`staleTime` a few minutes, seeded key) and renders the new rails high in the feed, right after the hero/Quick picks: New releases → Fresh finds for you → Speed dial/Listen again → Mixed for you → Trending → **New artists for you** (round artist cards) → Recommended albums → infinite extras.
- Graceful degradation: if YTM search returns nothing (quota/offline), those rails are hidden and the archive-based rails carry the feed, exactly as today.
- Infinite scroll gains discovery pages too, so scrolling keeps introducing unfamiliar artists rather than only archive deep cuts.

### 4. YTM layout polish
- Tighten card/rail sizing, captions and spacing to match YouTube Music (2-line card titles with subtitle caption, consistent rail gaps, header "More" affordance on hover), and make the mood chip row filter discovery queries too, not just the local pool.

## Technical notes

- Discovery tracks are normal `Track` objects with `source: "youtube"`, so play/queue/like/download all work through the existing player and `TrackMenu` with no changes.
- New-artist detection is client-side from returned track metadata plus `topArtists()` history, so no schema change is needed.
- Analytics: tag discovery fetches with the existing analytics events so quota fallbacks stay visible in the Insights tab.
