# Make the Android app real: installable, signed in, and playing music

The app file will load your live IMUSIC site inside a real Android app, so sign-in, playlists, likes and downloads all use the same live account you already have. Today the wrapper is only configured for the home page — this plan fixes the pieces that stop music, sign-in and background playback from working once it's on a phone, then produces the installable file.

## What you'll get

- A signed IMUSIC app file appearing automatically on your `/download` page.
- Music that starts on the first tap (no silent player) and keeps playing with the screen off, with play/pause on the lock screen.
- Spotify sign-in that works from inside the app and returns you to IMUSIC afterwards.
- Playlists, likes, listening history and offline songs saved to your account exactly like in the browser.

## Changes to make

### 1. Android app settings so audio actually plays
- Allow media to start without an extra tap inside the app shell.
- Keep the audio session alive when the screen turns off and show lock-screen controls.
- Add the Android permissions the player needs: internet, wake lock, foreground playback service, and notifications (for lock-screen controls and download alerts).

### 2. Spotify sign-in from inside the app
Spotify refuses to show its login inside an embedded app view, so the app will open Spotify's login in the phone's own browser and hand the result back to IMUSIC.
- Open the Spotify authorization page through the system browser when running on Android.
- Catch the return address and continue the existing sign-in flow inside the app.
- Keep the browser behaviour unchanged.

You'll need to add one address in your Spotify developer dashboard (Settings, Redirect URIs):
`https://imusic-com.lovable.app/spotify/callback` — plus `app.lovable.imusic://spotify/callback` as the in-app fallback.

### 3. Offline behaviour
- Keep the small offline screen already built, and make it retry automatically when the connection returns instead of getting stuck.

### 4. Ship it
- Bump the release workflow to install the Android plugins it now needs before the app is packaged.
- Then you run: generate the signing key, add four repository secrets, and start the release. Full click-by-click steps live in `docs/android-release.md` and I'll walk through them in chat.

## Technical notes

- `capacitor.config.ts`: add `android.webContentsDebuggingEnabled: false`, `appendUserAgent` marker so the web app can detect the native shell, and `server.androidScheme: "https"` stays so the site origin matches the web origin (session storage and OAuth redirect URI carry over unchanged).
- Add `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`, `@capacitor/splash-screen`, and a foreground-audio plugin so playback survives screen-off; register deep-link handling via `App.addListener('appUrlOpen')`.
- Patch `scripts/android-configure.mjs` to inject `<uses-permission>` entries (`WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`) and `settings.mediaPlaybackRequiresUserGesture = false` on the Capacitor bridge WebView.
- New `src/lib/native/platform.ts` exposing `isNativeAndroid()`; `src/lib/music/spotify-auth.ts` routes the authorize URL through `@capacitor/browser` when native and accepts the deep-link callback.
- `.github/workflows/android-release.yml`: no structural change beyond the new dependencies being present in `package.json` before `bunx cap add android`.
- No backend or database changes; the native app talks to the same live server functions and Cloud database.

## Not included

- iOS build (needs a Mac and an Apple developer account).
- Play Store submission — this is a directly installable file.
