# Create the IMUSIC GitHub repo and publish the first signed APK

## Goal
Create a public GitHub repository at `Ayush1708/imusic`, push the project code, generate a new signing keystore, and trigger the existing GitHub Actions workflow to build and publish the signed APK to GitHub Releases. The in-app `/download` page at `https://sonic-bloom-63.lovable.app/download` will then detect the release automatically.

## Why this is a manual repo
You chose a manual GitHub repo (not Lovable GitHub sync). That means you create the empty repo on GitHub and push the code from your local clone or the Lovable editor. The Android build itself still runs on GitHub Actions because the workflow file is already committed in the project.

## Exact steps

### 1. Create the public GitHub repository
1. Sign in to GitHub as `Ayush1708`.
2. Go to `https://github.com/new`.
3. Repository name: `imusic`.
4. Visibility: **Public** (required — the download page reads the GitHub releases API anonymously).
5. Do **not** initialize with README, `.gitignore`, or license (those files already exist in the project).
6. Click **Create repository**.

### 2. Push the project code to the new repo

From the project root (or your local clone), run:

```bash
# Replace the remote with the new repo
git remote add origin https://github.com/Ayush1708/imusic.git
# If an origin already exists, update it instead:
# git remote set-url origin https://github.com/Ayush1708/imusic.git

git branch -M main
git push -u origin main
```

The `android/` directory is intentionally gitignored, so the `android/` folder will be generated fresh on the GitHub Actions runner.

### 3. Generate the Android signing keystore

On your local machine, run the project helper script:

```bash
bash scripts/generate-keystore.sh
```

The script will:
- Create `imusic-release.keystore` in the repo root.
- Ask you to choose and confirm a keystore password (minimum 6 characters).
- Print the `ANDROID_KEY_ALIAS` and prompt you to save the password.
- Print the `ANDROID_KEYSTORE_BASE64` string to copy.

⚠️ **Back up `imusic-release.keystore` and the password somewhere safe.** Losing them means future APKs cannot update over existing installs.

### 4. Add GitHub Actions secrets

1. Go to `https://github.com/Ayush1708/imusic/settings/secrets/actions`.
2. Add these **Repository secrets**:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The full single-line base64 output from the helper script |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password you typed |
| `ANDROID_KEY_ALIAS` | `imusic` |
| `ANDROID_KEY_PASSWORD` | The same keystore password |

### 5. Trigger the release workflow

1. Go to `https://github.com/Ayush1708/imusic/actions/workflows/android-release.yml`.
2. Click **Run workflow**.
3. Enter a version, e.g. `1.0.0`.
4. Click **Run workflow**.

The workflow will:
- Install dependencies and build the offline fallback bundle.
- Create the native Android project (`bunx cap add android`).
- Sign the release APK with the keystore.
- Create a GitHub Release tagged `v1.0.0`.
- Attach `imusic-1.0.0.apk` as the release asset.

### 6. Verify the published APK

1. Open `https://github.com/Ayush1708/imusic/releases` and confirm the APK is attached.
2. Open `https://sonic-bloom-63.lovable.app/download` in the app or browser.
3. The page should show the latest version, release date, APK size, SHA-256, and a working download button.

## Notes

- The APK is never committed to the repo; it is stored as a GitHub Release asset, which is the standard practice for Android apps.
- Future releases only require clicking **Run workflow** again with a higher version. The `versionCode` in the generated Android build is derived automatically from the version string.
- The existing `android/RELEASE.md` file contains a manual fallback for local builds if you ever need to bypass GitHub Actions.

## What will not change in the codebase
No project files need to be edited for this task. The app already points to `Ayush1708/imusic` in `src/lib/android/release.ts` and the workflow is already configured in `.github/workflows/android-release.yml`.