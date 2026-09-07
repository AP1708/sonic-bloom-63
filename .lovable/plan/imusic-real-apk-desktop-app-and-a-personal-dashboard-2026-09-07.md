# IMUSIC: real APK, desktop app, and a personal dashboard

## What I can and can't do from here

I can't press the buttons that actually create your APK. Building and publishing a signed Android file needs two things only you control: your GitHub account and a signing key with its passwords. There is no Android build environment or GitHub access inside this workspace, and no keystore secrets to run the release with. So I'll get everything ready and give you a short, exact set of steps.

Everything else — the desktop version, the personal dashboard, the install walkthrough on the download page — I can build now.

## 1. Fix the app the APK will open

The Android wrapper currently points at an old address (`sonic-bloom-63.lovable.app`) instead of your live app (`imusic-com.lovable.app`). Anyone installing today's build would land on the wrong site. I'll correct that so the installed app opens the real IMUSIC.

## 2. Personal dashboard

A new "Your account" page you reach when signed in (no admin needed):

- Your name, avatar, email and when you joined, all editable inline
- Your account status: active, or suspended with the reason and end date shown plainly
- Connected Spotify / YouTube Music accounts with a disconnect button
- Quick counts: playlists, liked songs, offline downloads
- Sign out, and a link to your existing settings

It reads and writes only your own row, so it stays inside the security rules already in place.

## 3. Install walkthrough on /download

The download page gets a step-by-step Android install section (the `#install` anchor the finished-download button already jumps to):

- Step 1: tap Download and wait for the check to finish
- Step 2: open the file from your notifications or Downloads folder
- Step 3: allow "Install unknown apps" for your browser, with a note on where that switch lives on Android 8+ and Android 13+
- Step 4: tap Install, then Open
- Plus: what to do if Play Protect warns you, and how to confirm the file's fingerprint matches the published one

I'll also add an empty state that says the APK isn't published yet, so nobody taps a dead button.

## 4. Desktop version of IMUSIC

An Electron desktop shell that loads the live app in its own window with the IMUSIC icon, plus a `/desktop` download page listing Windows, macOS and Linux packages. I'll package the Linux build here so there's a real file to test; Windows and macOS are cross-packaged as zip folders (proper installers need machines this workspace doesn't have). The page detects your computer and highlights the right one.

## 5. Getting the real APK published (your steps)

I'll write these into a short guide in the project so you're not hunting through chat:

1. Connect GitHub from the + menu in the chat box, then create the repository — this pushes the code.
2. On your computer, run `bash scripts/generate-keystore.sh`. It asks for a password and prints four values.
3. In the GitHub repo: Settings → Secrets and variables → Actions → add `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. Actions tab → "Android release APK" → Run workflow → version `1.0.0`.
5. About ten minutes later the release appears, and `/download` on your phone picks it up automatically — no further changes needed.

Keep the keystore file forever. It's what lets future versions install over the old one.

## Technical notes

- `capacitor.config.ts`: `server.url` → `https://imusic-com.lovable.app`.
- New route `src/routes/_authenticated/account.tsx`; profile read/update through the existing owner-scoped `profiles` policies (`profiles_select_own`), connections via `user_music_connections`. Sidebar link added in the app shell.
- `/download`: extend the existing `#install` section in `src/routes/download.tsx`; no changes to the resumable download engine or checksum verification.
- Desktop: `electron/main.cjs` (CommonJS, contextIsolation on), `@electron/packager` for output, `vite.config.ts` gets `base: './'` only if a local fallback bundle is used; new route `src/routes/desktop.tsx` with OS detection mirroring `src/lib/apk/device.ts`.
- Release guide written to `docs/android-release.md`.
- Each new route gets its own title/description metadata.
