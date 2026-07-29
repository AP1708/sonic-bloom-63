## Goal

Keep music playing when you switch apps or the screen turns off, and let you pop the player out into a floating picture-in-picture window.

## What gets built

**1. Lock screen / notification controls (Media Session)**
- New `useMediaSession` hook wired into `player-provider.tsx`.
- Publishes title, artist, album and artwork for the current track, so Android/iOS lock screens, Chrome/Edge media hubs and Bluetooth/car controls show the song.
- Registers handlers for play, pause, next, previous, seek forward/back and seek-to, mapped to the existing player actions.
- Keeps `navigator.mediaSession.playbackState` and `setPositionState` in sync with the existing progress clock so the scrubber on the lock screen is accurate.

**2. Background playback hardening**
- Keep the `<audio>` element alive and never tear it down on route changes (it already lives in the provider — verify nothing pauses it on visibility change).
- Add a `playsInline` attribute and avoid pausing on `visibilitychange`.
- When the tab is hidden, prefer sources that survive backgrounding: direct Archive audio and the Spotify SDK. If the current source is the YouTube iframe and the page goes to the background on mobile, show a one-time hint that YouTube-sourced tracks can pause when backgrounded (browser policy we cannot override), and try to re-resolve to a direct/Spotify source when one exists.

**3. Picture-in-picture mini player**
- New "Pop out player" button in `player-bar.tsx` and `fullscreen-player.tsx`.
- Uses the Document Picture-in-Picture API (Chrome/Edge desktop) to open a small always-on-top window rendering a compact player: artwork, title/artist, play/pause, next/prev and progress. Styles are cloned from the app so it matches the Neon Mint theme.
- For YouTube-sourced tracks, the existing floating YouTube iframe is moved into the PiP window so video/audio keeps playing, and moved back when PiP closes.
- The button hides automatically when the browser has no PiP support.

**4. Installability (helps mobile background audio)**
- Add a web app manifest plus icons and head tags so the app can be added to the home screen. Installed standalone apps on Android keep audio running with the screen off far more reliably than a browser tab. No service worker or offline mode.

## Honest limitations

- Audio can keep playing with the screen off or the app backgrounded, but **not after the browser/tab is fully closed** — no web app can do that.
- On iOS Safari, background audio works for direct audio streams; YouTube-iframe-sourced tracks will pause when the app is backgrounded (Apple/YouTube policy).
- Document picture-in-picture is desktop Chromium only today; other browsers get the button hidden.

## Technical notes

- Files touched: `src/components/player/player-provider.tsx`, `player-bar.tsx`, `fullscreen-player.tsx`, new `src/hooks/use-media-session.ts`, new `src/components/player/pip-player.tsx`, `public/manifest.webmanifest` + icons, head tags in `src/routes/__root.tsx`.
- No database or backend changes.
