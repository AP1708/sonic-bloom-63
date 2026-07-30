import { createServerFn } from "@tanstack/react-start";
import { abiFromAssetName } from "@/lib/apk/device";
import {
  ANDROID_RELEASE_REPO,
  type AndroidReleaseResult,
  type ApkVariant,
} from "@/lib/apk/release";


type GithubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type GithubRelease = {
  tag_name?: string;
  name?: string;
  body?: string | null;
  published_at?: string | null;
  assets?: GithubAsset[];
};

// Simple in-memory cache so the unauthenticated GitHub API rate limit is never
// a concern, even under traffic. 10 minutes is plenty for release lookups.
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; value: AndroidReleaseResult } | null = null;

export const getLatestAndroidRelease = createServerFn({ method: "GET" }).handler(
  async (): Promise<AndroidReleaseResult> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

    let value: AndroidReleaseResult;
    try {
      const response = await fetch(
        `https://api.github.com/repos/${ANDROID_RELEASE_REPO}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "imusic-download-page",
          },
        },
      );

      if (response.status === 404) {
        value = { status: "none" };
      } else if (!response.ok) {
        const body = await response.text();
        console.error(`GitHub releases lookup failed [${response.status}]: ${body}`);
        value = { status: "error", message: `GitHub returned ${response.status}` };
      } else {
        const release = (await response.json()) as GithubRelease;
        const variants: ApkVariant[] = (release.assets ?? [])
          .filter((asset) => asset.name.toLowerCase().endsWith(".apk"))
          .map((asset) => ({
            abi: abiFromAssetName(asset.name),
            apkUrl: asset.browser_download_url,
            apkName: asset.name,
            sizeBytes: asset.size,
          }));
        // Default to the universal build so one-tap flows work on any device.
        const primary = variants.find((variant) => variant.abi === "universal") ?? variants[0];
        value = primary
          ? {
              status: "ok",
              release: {
                version: (release.tag_name ?? release.name ?? "").replace(/^v/, "") || "latest",
                publishedAt: release.published_at ?? null,
                apkUrl: primary.apkUrl,
                apkName: primary.apkName,
                sizeBytes: primary.sizeBytes,
                notes: release.body ?? null,
                variants,
              },
            }
          : { status: "none" };

      }
    } catch (error) {
      console.error("GitHub releases lookup threw", error);
      value = { status: "error", message: "Could not reach GitHub" };
    }

    cache = { at: Date.now(), value };
    return value;
  },
);
