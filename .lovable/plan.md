IMUSIC Android APK is already published to GitHub Releases (not to the repo itself). The workflow is in `.github/workflows/android-release.yml`. The only thing left is to add the signing keystore as GitHub repository secrets and trigger the workflow.

## What we will do

1. Explain why GitHub Releases is the correct place for the APK (not the repo files).
2. Add four repository secrets to `Ayush1708/imusic` so the workflow can sign the APK.
3. Trigger the workflow once.
4. Verify the release appears on the in-app `/download` page.

## Exact steps

### Step 1 — Encode the keystore

From the repo root, run:

```bash
base64 -w0 imusic-release.keystore > keystore.b64
```

Then open `keystore.b64` and copy the entire single-line string.

### Step 2 — Add GitHub repository secrets

Go to `https://github.com/Ayush1708/imusic/settings/secrets/actions` and add these **Repository secrets**:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The full content of `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | Your keystore store password |
| `ANDROID_KEY_ALIAS` | `imusic` |
| `ANDROID_KEY_PASSWORD` | Your key password |

### Step 3 — Trigger the workflow

1. Go to `https://github.com/Ayush1708/imusic/actions/workflows/android-release.yml`
2. Click **Run workflow**
3. Enter a version, e.g. `1.0.0`, then click **Run workflow**

The workflow will:

- Build the web app
- Create the native Android project
- Sign the release APK with the keystore
- Create a GitHub Release tagged `v1.0.0`
- Attach `imusic-1.0.0.apk` as the release asset

### Step 4 — Verify

- Open the release page: `https://github.com/Ayush1708/imusic/releases`
- Confirm the APK is attached.
- Open `https://sonic-bloom-63.lovable.app/download` in the IMUSIC app — it should show the latest version, size, SHA-256, and an install button.

## Notes

- The APK is never committed to the repo; it is stored as a release asset, which is the standard practice for Android apps.
- The `android/RELEASE.md` file already contains these instructions plus manual fallback steps.
- Future releases only require clicking **Run workflow** again with a higher version (and higher `versionCode` in `android/app/build.gradle`).