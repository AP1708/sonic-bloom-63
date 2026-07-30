## Goal

Get an installable IMUSIC APK published on your GitHub, with the in-app `/download` page automatically serving whatever the latest release is.

I'll assume the repo is **`Ayush1708/imusic`** — tell me if the repo name differs and I'll use that instead.

## What changes

1. **Point the app at your repo**
   - `src/lib/android/release.ts`: change `ANDROID_RELEASE_REPO` from `AP1708/imusic` to `Ayush1708/imusic`.
   - The `/download` route already fetches the newest GitHub Release, picks the `.apk` asset, and shows version, size, SHA-256 and install steps — so once a release exists there, the page updates itself with no further code changes.

2. **Keystore generation (you run it once, locally)**
   - Keep `scripts/generate-keystore.sh`, and add a short `android/RELEASE.md` covering:
     - generating the keystore (`keytool`, alias, validity, passwords),
     - where to keep it safe (never commit it),
     - the base64 export used if you later want CI signing.

3. **Manual build + upload guide**
   - Same `android/RELEASE.md` documents the local flow:
     `bun run build` → `npx cap sync android` → `./gradlew assembleRelease` → sign with the keystore → rename to `imusic-<version>.apk`.
   - Then: create a GitHub Release tagged `v<version>` in `Ayush1708/imusic` and attach the APK. Nothing else needed — the download page reads it live.

4. **Tidy the CI workflow**
   - Since you're uploading manually, `.github/workflows/android-release.yml` gets switched to `workflow_dispatch` only (no auto-run on tag push), so it never fails for missing keystore secrets but stays available if you later want automated builds.

5. **Getting the code onto GitHub**
   - The APK lives in GitHub Releases, not in the repo, but the project itself needs to be synced first: connect via the **+ menu → GitHub → Connect project**, creating/selecting `Ayush1708/imusic`. I can't do that step for you — it's an authorization flow on your account.

## Technical notes

- Release lookup uses the public GitHub API (`/repos/{owner}/{repo}/releases/latest`), so the repo must be public or the page will show "no release yet".
- SHA-256 shown on the download page is computed from the release asset digest / downloaded bytes; no extra metadata file is required.
- Nothing about signing keys is stored in Lovable — the keystore and its passwords stay on your machine.

## Out of scope

- Building the APK inside Lovable (no Android SDK here) — the build runs on your machine or in GitHub Actions.
- Play Store submission.
