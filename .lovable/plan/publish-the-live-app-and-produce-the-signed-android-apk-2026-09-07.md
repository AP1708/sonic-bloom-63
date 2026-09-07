# Publish the live app and produce the signed Android APK

## What I can do here vs what only you can do

The Android app is a thin native shell that loads the live site at
`https://imusic-com.lovable.app` (confirmed in `capacitor.config.ts`). That means:

- Publishing the site is what refreshes the phone app. Once published, the
  installed app shows the new version on next open — no rebuild needed for
  web changes.
- A new APK is only needed for native changes (icons, permissions, plugins)
  or because no signed APK exists yet.

Three steps need your own hands, because they involve a private signing key,
your GitHub account, and GitHub's runners — none of which exist in this
workspace:

- generating the keystore (it asks for a password only you should know)
- pasting the four secrets into GitHub
- starting the release run

I will prepare everything around those steps and verify the results.

## Steps

1. Publish the app from the Publish button so the live URL serves the current
   version. I will confirm the published site responds and is up to date.
2. You run, on your own computer, inside the project folder:
   `bash scripts/generate-keystore.sh`
   It asks for a password twice and then prints the four values. Keep the
   generated `imusic-release.keystore` file and password backed up — losing
   them means future updates cannot install over this app.
3. You add the four printed values in your repository under
   Settings, Secrets and variables, Actions:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. You start the run: repository Actions tab, "Android release APK",
   Run workflow. It builds, signs, and attaches the APK files to a new
   release.
5. I verify the download page picks the new release up: correct version,
   working device-matched build, checksum shown, and the install steps
   visible.

## Notes

- I will re-check `docs/android-release.md` so the written instructions match
  these exact steps and secret names, and adjust the wording if anything drifted.
- Before you install: the app opens the live site, so also add both Spotify
  redirect addresses in your Spotify developer settings
  (`https://imusic-com.lovable.app/spotify/callback` and
  `app.lovable.imusic://spotify/callback`), otherwise Spotify sign-in inside
  the phone app fails.
- No iOS build and no Play Store submission are part of this.

## Technical detail

- `capacitor.config.ts` uses `server.url` pointing at the published domain,
  with `dist-android` as the offline fallback bundle only.
- `.github/workflows/android-release.yml` decodes the base64 keystore, runs
  `scripts/android-configure.mjs` (permissions, deep link, WebView media
  settings), builds per-ABI plus universal APKs, signs them, and publishes a
  GitHub Release with SHA-256 hashes.
- `/download` reads the newest release through
  `src/lib/apk/release.functions.ts` and selects a variant with
  `src/lib/apk/device.ts`; `/desktop` uses the separate desktop workflow.
