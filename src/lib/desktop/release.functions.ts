import { createServerFn } from "@tanstack/react-start";
import {
  DESKTOP_RELEASE_REPO,
  osFromAssetName,
  type DesktopBuild,
  type DesktopReleaseResult,
} from "@/lib/desktop/release";

type GithubAsset = { name: string; browser_download_url: string; size: number };
type GithubRelease = {
  tag_name?: string;
  name?: string;
  published_at?: string | null;
  assets?: GithubAsset[];
};

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; value: DesktopReleaseResult } | null = null;

/** Latest published desktop packages, read from GitHub Releases. */
export const getLatestDesktopRelease = createServerFn({ method: "GET" }).handler(
  async (): Promise<DesktopReleaseResult> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

    let value: DesktopReleaseResult;
    try {
      const response = await fetch(
        `https://api.github.com/repos/${DESKTOP_RELEASE_REPO}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "imusic-desktop-download-page",
          },
        },
      );

      if (response.status === 404) {
        value = { status: "none" };
      } else if (!response.ok) {
        const body = await response.text();
        console.error(`GitHub desktop release lookup failed [${response.status}]: ${body}`);
        value = { status: "error", message: `GitHub returned ${response.status}` };
      } else {
        const release = (await response.json()) as GithubRelease;
        const builds: DesktopBuild[] = [];
        for (const asset of release.assets ?? []) {
          const os = osFromAssetName(asset.name);
          if (!os) continue;
          builds.push({
            os,
            fileName: asset.name,
            url: asset.browser_download_url,
            sizeBytes: asset.size,
          });
        }
        value = builds.length
          ? {
              status: "ok",
              version: (release.tag_name ?? release.name ?? "").replace(/^v/, "") || "latest",
              publishedAt: release.published_at ?? null,
              builds,
            }
          : { status: "none" };
      }
    } catch (error) {
      console.error("GitHub desktop release lookup threw", error);
      value = { status: "error", message: "Could not reach GitHub" };
    }

    cache = { at: Date.now(), value };
    return value;
  },
);
