## Goal

Rename the app to **IMUSIC** and regenerate the favicon and PWA icons with a new abstract brand mark.

## The mark

An abstract geometric glyph — a stacked waveform/pulse arc forming an implied "I" column — in the app's amber accent on the near-black canvas. No literal letters, square, readable at 16px.

## What changes

**New icon assets**
- Generate the master mark, then export the sizes the app already references:
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png` (also used as maskable)
  - `public/favicon.png` (new, replaces the default `.ico`)
- Delete the stale `public/favicon.ico` and point `__root.tsx`'s icon link at the new PNG.

**Manifest** (`public/manifest.webmanifest`)
- `name`: "IMUSIC — Spotify and YouTube Music in one player"
- `short_name`: "IMUSIC"
- Icons repointed to the regenerated files (background/theme colors unchanged).

**Name rollout**
User-facing "Sonance" strings become "IMUSIC" across:
- `src/routes/__root.tsx` — title, description, og:title, author, apple web app title
- Per-route `head()` titles/descriptions: `index`, `search`, `auth`, `settings`, `artists/*`, `_authenticated/*` (library, liked, downloads, admin, playlist)
- Sidebar/app-shell wordmark, connections menu copy, Spotify/YouTube callback copy, media-session and offline/query-persist labels

Internal storage keys (localStorage/IndexedDB/query-persist prefixes) get renamed only where a rename won't wipe existing local data; otherwise the key stays and only the label changes.

## Verification

Load `/` in a headless browser, confirm the new favicon resolves 200, the document title reads IMUSIC, and screenshot the header wordmark. Fetch the manifest and confirm both icon URLs return the new PNGs.
