## Goal

Ship IMUSIC as an installable Android APK, signed with a stable release key, built automatically in CI, and offer it from an in-app `/download` page that always shows the newest published version.

Nothing Android-related exists yet (no `android/`, no Capacitor, no download route), so this is a fresh setup.

## 1. Capacitor Android wrapper

- Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`.
- Add `capacitor.config.ts`: app id `app.lovable.imusic`, app name `IMUSIC`, web dir pointing at the built client output, and a `server.url` pointing at the published site so the APK loads the live app (keeps YouTube Music / Spotify playback, auth, and Cloud data working exactly as on the web).
- Generate the native `android/` project and drop in the existing IMUSIC icon set as launcher icons plus a splash matching the dark theme.
- Android manifest: internet permission, `usesCleartextTraffic` off, foreground/audio-friendly config so background playback behaves like the PWA.

## 2. Release signing (stable key, kept in GitHub secrets)

- Add `scripts/generate-keystore.sh`: runs `keytool` once locally, prints the base64 of the keystore, and lists exactly which four GitHub repository secrets to paste it into:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- The build reads those secrets, decodes the keystore into the runner, and signs `release` via a Gradle signing config that falls back to unsigned when the secrets are absent (so forks/PRs still build).
- Keystore file itself is gitignored — only the CI secrets hold it. Losing it means future updates can't install over old ones, so the script warns to back it up.

## 3. CI workflow: `.github/workflows/android-release.yml`

- Triggers: pushing a `v*` tag, plus manual dispatch with a version input.
- Steps: checkout, Bun install, web build, `cap sync android`, JDK 17 + Android SDK setup, `gradlew assembleRelease`, `zipalign`/`apksigner` verification, then publish a GitHub Release for the tag with the APK attached as `imusic-<version>.apk`.
- Version name/code derive from the tag so each release is a clean upgrade over the last.
- Release body notes the SHA-256 fingerprint of the APK for verification.

## 4. `/download` page wired to GitHub Releases

- New route `src/routes/download.tsx` with IMUSIC-styled dark UI and its own SEO head (title/description/og).
- A server function fetches the latest release from `https://api.github.com/repos/<owner>/<repo>/releases/latest` (cached server-side ~10 min to stay well under the unauthenticated rate limit) and returns version, publish date, APK asset URL, and file size.
- The page shows: version badge, release date, APK size, a primary "Download APK for Android" button pointing at the asset, install instructions (allow install from unknown sources), and the SHA-256 line.
- Graceful states: loading skeleton, and a fallback panel pointing at the releases page plus the "Install as web app" PWA prompt when no release exists yet or the API call fails.
- Link the page from the existing install button / settings area so it's reachable.

## Technical notes

- You answered the repo as `AP1708`, which is the owner without a repo name. I'll put the target in one constant (`src/lib/android/release.ts`, defaulting to `AP1708/imusic`) — tell me the actual repo name and I'll set it, or edit that one line later.
- The APK is a thin shell over the published site, so app updates ship instantly on publish; a new APK is only needed for native changes (icons, permissions, Capacitor version).
- Nothing in this plan touches the database, RLS, or existing playback code.

## What you'll need to do once

1. Run `scripts/generate-keystore.sh` locally (needs Java's `keytool`).
2. Paste the four values into GitHub → repo Settings → Secrets → Actions.
3. Push a tag like `v1.0.0` (or run the workflow manually) — the signed APK appears on the Releases page and `/download` picks it up automatically.
