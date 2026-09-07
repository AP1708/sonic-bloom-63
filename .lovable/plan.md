# Better APK download feedback: live speed, verified file, reliable notification

Three improvements to the download page and the download engine behind it.

## 1. Live progress with speed and time remaining

- Track a rolling sample of bytes received over the last few seconds (smoothed, so the number does not jump around).
- Expose download speed (e.g. "4.2 MB/s") and estimated time left (e.g. "about 1 min 20 s left") alongside the existing byte counts and percentage.
- Show them under the progress bar while downloading; hide them while paused, and show "Paused" instead. During the final assembling step show "Finishing up…".
- Keep the bar accessible: the spoken/announced label includes percent, speed and remaining time.

## 2. Notification permission asked up front

- When the user starts a download, ask for notification permission right away (a click-driven request, which browsers accept) instead of only at the end — so the completion notification actually appears the first time.
- If permission is denied or notifications are unsupported, nothing breaks: the on-page success toast with "Open install page" remains the fallback, plus a persistent success panel on the page itself so a missed toast is still recoverable.
- Only ask once per browser; never re-prompt if already denied.

## 3. Verify the file before declaring success

- Read the expected SHA-256 for the selected build from the release notes (already parsed on the page) and pass it into the download.
- After the chunks are assembled, hash the file in the browser and compare.
- Match: save the file, show the success toast + "Open install page" action, and fire the system notification.
- Mismatch: do not save or notify. Show a clear error ("The downloaded file didn't match the official checksum"), discard the saved chunks, and offer Retry.
- No checksum published for that build: download proceeds as today, and the page notes the file could not be verified.

## Technical notes

- `src/lib/apk/apk-download.ts`: add optional `expectedSha256` to `runResumableDownload`; verify with `crypto.subtle.digest("SHA-256", …)` over the assembled blob before returning. Throw a distinct `ChecksumMismatchError`. Add a `verifying` phase to `ApkDownloadPhase` and emit progress for it.
- `src/hooks/use-apk-download.ts`: accept `expectedSha256` on the release argument; add speed/ETA computation from timestamped progress samples (EMA over ~3 s window); request `Notification.requestPermission()` inside `start()`; handle `ChecksumMismatchError` by clearing the stored download, setting an error, and emitting an `apk_download_failed` analytics event with reason `checksum_mismatch`.
- `src/routes/download.tsx`: pass the parsed per-variant SHA into `useApkDownload`; render speed/ETA/status text and a verified/unverified badge; keep existing ARIA attributes and add the new values to the progressbar label.
- Reuse the existing `formatBytes` helper; add small `formatRate` / `formatDuration` helpers in `src/lib/apk/release.ts`.
