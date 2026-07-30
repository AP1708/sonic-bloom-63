## Goal

Make every playback-adjacent path (playback resolution, lyrics, smart downloads) source its YouTube data from the YouTube Music catalog path, and turn the embedded video player into a YouTube Music-style audio player.

## Current state (verified)

- `youtube.functions.ts` already tries `youtubeMusicSearch` (music.youtube.com innertube, `WEB_REMIX`) first, then keyless web search, then the Data API — so the music catalog is preferred at the search layer.
- `resolve-playback.ts` still resolves with video-style queries (`"<artist> <title> official audio"`) and scores candidates with video heuristics, so matches can land on generic video uploads rather than the Music song entry.
- `use-lyrics.ts` sends the raw `track.title` / `track.artist` to LRCLIB. For tracks whose metadata came from a video upload, the title still contains video noise, which hurts lyric matches.
- `smart-downloads.ts` builds candidates from liked tracks, history, the Archive catalog and `findRelatedTracks` (which goes through `searchAll`). Non-Archive tracks are metadata-"pinned", not downloaded.
- The player uses the official YouTube IFrame Player API, rendered as a visible video surface.

## Changes

### 1. YouTube Music-first resolution

- Add a music-mode option to the YouTube search server function so callers can request "songs catalog only" (skip keyless-web/Data-API video fallbacks, or mark those results as `video` origin).
- Update `resolve-playback.ts`:
  - Drop the `"official audio"` suffix on pass 1; query the Music catalog with plain `artist title` (Music results are already song-scoped).
  - Prefer candidates whose strategy is `ytm_innertube`; only fall back to video-derived candidates when the Music catalog returns nothing.
  - Keep the existing scoring (duration proximity, artist/title coverage, bad-term penalties) as the tiebreaker, and keep the current analytics tags with the strategy recorded.

### 2. Lyrics panel pulls Music metadata

- Before calling LRCLIB, normalise the track through the Music metadata: when the current track has a resolved YouTube Music match, use that match's clean song title / artist / duration as the lyrics query, falling back to the raw track fields.
- Keep the existing progressive title-variant fallback and the "no lyrics available" empty state unchanged.

### 3. Smart downloads use Music sources

- In `buildCandidates`, route the discovery step through the Music-first search (via `findRelatedTracks` with the music-mode source) so suggested tracks are songs, not videos.
- Keep Archive tracks as the only true audio downloads; YouTube Music entries stay "Pinned" (metadata only) — label them "YouTube Music" in the status chips.
- Analytics events keep the same names, with `source: "youtube"` values relabelled to reflect the Music origin.

### 4. YouTube Music player

Technical note: YouTube Music has no embeddable player of its own, and music.youtube.com cannot be framed. The sanctioned way to play a Music track is the YouTube IFrame Player API pointed at that song's video id. So the player is re-shaped rather than swapped:

- Render the IFrame host as an audio-style surface: hidden/offscreen video, with our own artwork + title + artist + transport UI driving it (matching the YouTube Music look) instead of the visible video box.
- Load videos with music-friendly params (`playsinline`, no related videos, no annotations, controls off), keep progress polling, volume, seek and the existing 15s watchdog / auto-skip behaviour intact.
- Rebrand every remaining player-side string and badge to "YouTube Music", including the mobile background-playback notice.

### 5. Verification

- Headless run: search a Spotify-only track, confirm it resolves via the Music catalog, plays through the reshaped player, advances on end, and the lyrics pane populates or shows the graceful fallback.
- Confirm the Downloads page still reports Ready/Pinned/Failed correctly.
