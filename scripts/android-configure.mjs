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
