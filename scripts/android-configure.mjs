#!/usr/bin/env node
/**
 * Patches the Capacitor-generated android/app/build.gradle with:
 *  - a release signingConfig fed by environment variables (CI secrets)
 *  - versionName / versionCode derived from the release tag
 *
 * Falls back to an unsigned release build when the keystore env vars are
 * absent, so forks and PR builds still compile.
 *
 * Usage: node scripts/android-configure.mjs <versionName>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const gradlePath = "android/app/build.gradle";
if (!existsSync(gradlePath)) {
  console.error(`Missing ${gradlePath} — run "npx cap add android" first.`);
  process.exit(1);
}

const versionName = (process.argv[2] || "0.0.1").replace(/^v/, "");
const [major = 0, minor = 0, patch = 0] = versionName
  .split(".")
  .map((part) => Number.parseInt(part, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

let gradle = readFileSync(gradlePath, "utf8");

const signingBlock = `
    signingConfigs {
        release {
            def storeFilePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (storeFilePath != null && !storeFilePath.isEmpty()) {
                storeFile file(storeFilePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;

if (!gradle.includes("signingConfigs {")) {
  gradle = gradle.replace(/buildTypes\s*\{/, `${signingBlock.trim()}\n    buildTypes {`);
}

// Per-ABI splits: smaller downloads per device, plus a universal fallback.
const splitsBlock = `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86_64"
            universalApk true
        }
    }
`;

if (!gradle.includes("splits {")) {
  gradle = gradle.replace(/buildTypes\s*\{/, `${splitsBlock.trim()}\n    buildTypes {`);
}


// Attach the signing config to the release build type.
gradle = gradle.replace(
  /buildTypes\s*\{\s*release\s*\{/,
  `buildTypes {
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                signingConfig signingConfigs.release
            }`,
);

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

writeFileSync(gradlePath, gradle);
console.log(`Configured Android build: versionName=${versionName} versionCode=${versionCode}`);
console.log(
  process.env.ANDROID_KEYSTORE_PATH
    ? "Release signing: enabled (keystore provided)."
    : "Release signing: disabled (no keystore secrets) — output will be unsigned.",
);

/* ------------------------------------------------------------------ *
 * AndroidManifest: playback permissions + Spotify sign-in deep link.
 * ------------------------------------------------------------------ */
const manifestPath = "android/app/src/main/AndroidManifest.xml";
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, "utf8");

  const permissions = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.WAKE_LOCK",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.POST_NOTIFICATIONS",
  ];
  const missing = permissions
    .filter((name) => !manifest.includes(`"${name}"`))
    .map((name) => `    <uses-permission android:name="${name}" />`)
    .join("\n");
  if (missing) manifest = manifest.replace("</manifest>", `${missing}\n</manifest>`);

  // Custom-scheme callback: Spotify's consent screen runs in the phone browser
  // and returns to app.lovable.imusic://spotify/callback.
  if (!manifest.includes("app.lovable.imusic\" />")) {
    const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="app.lovable.imusic" />
            </intent-filter>`;
    manifest = manifest.replace(/(\n\s*<\/activity>)/, `${intentFilter}$1`);
  }

  writeFileSync(manifestPath, manifest);
  console.log("Patched AndroidManifest.xml: playback permissions + deep link.");
}

/* ------------------------------------------------------------------ *
 * MainActivity: let audio start without an extra tap and keep the
 * WebView alive while the screen is off.
 * ------------------------------------------------------------------ */
const activityPath = "android/app/src/main/java/app/lovable/imusic/MainActivity.java";
if (existsSync(activityPath)) {
  let activity = readFileSync(activityPath, "utf8");
  if (!activity.includes("mediaPlaybackRequiresUserGesture")) {
    activity = activity.replace(
      /public class MainActivity extends BridgeActivity \{/,
      `public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        android.webkit.WebSettings settings = this.bridge.getWebView().getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDomStorageEnabled(true);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
`,
    );
    writeFileSync(activityPath, activity);
    console.log("Patched MainActivity.java: media autoplay + wake handling.");
  }
}
