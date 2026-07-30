import { createServerFn } from "@tanstack/react-start";
import {
  ANDROID_RELEASE_REPO,
  type AndroidReleaseResult,
} from "@/lib/android/release";

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
        const apk = release.assets?.find((asset) => asset.name.endsWith(".apk"));
        value = apk
          ? {
              status: "ok",
              release: {
                version: (release.tag_name ?? release.name ?? "").replace(/^v/, "") || "latest",
                publishedAt: release.published_at ?? null,
                apkUrl: apk.browser_download_url,
                apkName: apk.name,
                sizeBytes: apk.size,
                notes: release.body ?? null,
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
