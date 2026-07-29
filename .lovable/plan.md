## Goal

Three changes to the player experience:

1. Drop the pop-out (picture-in-picture) mini player entirely.
2. When a song is open in the fullscreen player, show the play queue right there.
3. Keep the queue alive automatically — when it runs low, append songs that match the current track's artist and style.

## 1. Remove picture-in-picture

- Delete `src/components/player/pip-player.tsx`.
- Remove the pop-out button and `usePictureInPicture` usage from `src/components/player/player-bar.tsx` and `src/components/player/fullscreen-player.tsx`.
- Remove `PictureInPictureProvider` from `src/routes/__root.tsx`.
- Leave lock-screen / media-key controls (`use-media-session.ts`) untouched — those are what keep audio going with the screen off.

## 2. Queue inside the fullscreen player

Restructure `fullscreen-player.tsx` into a two-part layout:

```text
desktop                              mobile
+----------------+--------------+    [ artwork + controls ]
|  artwork       |  Up next     |    [ Up next  |  Lyrics ] tabs
|  title/artist  |  queue list  |    [ scrollable list      ]
|  seek + ctrls  |  ...         |
+----------------+--------------+
```

- A right-hand "Up next" column on large screens; on phones a tab strip under the controls switching between **Up next** and **Lyrics**, with the list scrolling under the transport controls.
- Each queue row: artwork, title, artist, duration, source tag; the playing row is highlighted; tapping a row jumps to it; each row gets a remove button, plus a Clear action for the whole queue.
- The queue rows reuse the existing queue/lyrics rendering from `side-panel.tsx` by extracting them into shared components (`QueueList`, `LyricsPane`) so the docked side panel and the fullscreen view stay in sync and there is no duplicated logic.

## 3. Auto-queue related songs

New module `src/lib/music/related.ts` plus wiring in `player-provider.tsx`:

- Trigger: whenever there are fewer than 3 tracks left after the current one and autoplay-radio is on.
- Candidate sources, in order:
  1. Same artist — search the artist name across the catalog (Archive/Indian catalog first, since those play instantly), excluding tracks already in the queue or recently played.
  2. Similar songs — search using the track title's key words plus the artist, taking results from Spotify/YouTube/Archive via the existing `searchAll`.
  3. Fallback — tracks from the same collection/shelf in the local catalog.
- Score and de-duplicate: prefer same-artist matches, then same-source matches, drop anything whose id is already queued, cap at ~10 appended tracks per top-up.
- Appended tracks show a subtle "Radio" / "Suggested" label in the queue list so it's clear they were added automatically.
- A toggle in the queue header ("Autoplay similar songs") turns the behaviour off; the choice is remembered locally.
- Failures are silent — if search is rate-limited, the queue simply doesn't grow and playback is unaffected.

## Technical notes

- `related.ts` runs client-side through the existing `searchAll` provider abstraction, so it inherits the YouTube key-rotation and caching already in place.
- Top-up is de-bounced and guarded by an in-flight ref so track changes can't fire several searches at once.
- Queue additions go through the existing `enqueue` state path; no schema or backend changes are needed.
