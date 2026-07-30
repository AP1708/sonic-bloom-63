# Resumable APK download

Today the download card just sets `window.location.href` to the GitHub asset URL, so the browser owns the transfer and a dropped connection means starting over. This replaces that with an in-app chunked downloader that remembers progress and continues from where it stopped.

## How it will work

1. The APK is fetched in chunks with `Range: bytes=<start>-<end>` requests (8 MB per chunk).
2. Each completed chunk is stored in IndexedDB, keyed by release version + asset URL, together with the total size and the server's `ETag`.
3. If the tab is closed, the network drops, or the user hits Pause, the next attempt resumes from the first missing byte instead of byte 0.
4. When all bytes are present, the chunks are joined into a single `Blob` and handed to the browser as a normal file save (`<a download>` + object URL), then the cached chunks are cleared.
5. `ETag` mismatch or a new release version invalidates the stored chunks and restarts cleanly, so a partially downloaded old APK is never merged with a new one.

## Cross-origin handling

GitHub asset downloads redirect to a storage host that does not reliably allow browser range reads from another origin. To make this dependable, downloads go through a same-origin streaming proxy route (`/api/public/apk`) that:
- only accepts the known IMUSIC release repo asset URLs (allowlist, no open proxy),
- forwards the client's `Range` header upstream and returns the upstream `206`/`200` response with `Content-Range`, `Content-Length`, `Accept-Ranges` and `ETag` intact.

If the proxy or the server does not support ranges (`Accept-Ranges: none`), the downloader falls back to a single streamed request, and if that also fails it falls back to today's direct browser download so users are never blocked.

## UI changes

In the download card and the `/download` page:
- Progress bar with percent, downloaded / total size, and live transfer state.
- Buttons: **Download** → **Pause** / **Resume**, plus **Cancel** (clears cached chunks).
- On reopening the app with a partial download present: "Resume download — 42% already downloaded".
- Connection-drop errors auto-retry a chunk up to 3 times with backoff; after that an error state with a Retry button and an error toast.
- ARIA: `role="progressbar"` with `aria-valuenow/valuemin/valuemax`, polite live region for state changes, explicit labels on pause/resume/cancel — matching the accessibility work already done on this card.

## Technical details

- `src/lib/android/apk-download.ts` — chunked range downloader: probes with a `HEAD`/`Range: bytes=0-0` request for size + `Accept-Ranges` + `ETag`, loops missing chunks with `AbortController`, emits progress events.
- `src/lib/android/apk-download-store.ts` — IndexedDB store (`imusic-apk`) holding chunk blobs and a manifest record; reuses the existing offline IndexedDB patterns in `src/lib/offline/store.ts`.
- `src/hooks/use-apk-download.ts` — React hook exposing `{ state, progress, bytesDone, totalBytes, start, pause, resume, cancel, error }`.
- `src/routes/api/public/apk.ts` — server route proxying the allowlisted GitHub asset with range passthrough.
- `src/components/apk/apk-download-card.tsx` and `src/routes/download.tsx` — wire the hook in, add progress + controls; keep the existing loading/retry/error behaviour for the release lookup itself.
- Analytics: reuse the existing event tagging to record `apk_download_start`, `apk_download_resume`, `apk_download_complete`, `apk_download_failed`.
