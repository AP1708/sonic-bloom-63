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

function buildsOf(release: GithubRelease): DesktopBuild[] {
  const builds: DesktopBuild[] = [];
  for (const asset of release.assets ?? []) {
    const os = osFromAssetName(asset.name);
    if (!os) continue;
    builds.push({ os, fileName: asset.name, url: asset.browser_download_url, sizeBytes: asset.size });
  }
  return builds;
}

/** Newest release that carries desktop packages, read from GitHub Releases. */
export const getLatestDesktopRelease = createServerFn({ method: "GET" }).handler(
  async (): Promise<DesktopReleaseResult> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

    let value: DesktopReleaseResult;
    try {
      // Android and desktop share the repository, so scan recent releases for
      // the newest one that actually contains desktop packages.
      const response = await fetch(
        `https://api.github.com/repos/${DESKTOP_RELEASE_REPO}/releases?per_page=20`,
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
        const releases = (await response.json()) as GithubRelease[];
        const match = releases
          .map((release) => ({ release, builds: buildsOf(release) }))
          .find((entry) => entry.builds.length > 0);
        value = match
          ? {
              status: "ok",
              version:
                (match.release.tag_name ?? match.release.name ?? "")
                  .replace(/^desktop-/, "")
                  .replace(/^v/, "") || "latest",
              publishedAt: match.release.published_at ?? null,
              builds: match.builds,
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
