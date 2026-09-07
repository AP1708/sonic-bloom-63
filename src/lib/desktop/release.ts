import { ANDROID_RELEASE_REPO } from "@/lib/apk/release";

/** Desktop builds are published in the same GitHub repository as the APK. */
export const DESKTOP_RELEASE_REPO = ANDROID_RELEASE_REPO;
export const DESKTOP_RELEASES_URL = `https://github.com/${DESKTOP_RELEASE_REPO}/releases`;

export type DesktopOs = "windows" | "mac" | "linux";

export const OS_LABEL: Record<DesktopOs, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
};

export const OS_HINT: Record<DesktopOs, string> = {
  windows: "Unzip the folder and run IMUSIC.exe.",
  mac: "Unzip, then drag IMUSIC to Applications.",
  linux: "Extract the archive and run the IMUSIC file inside.",
};

export type DesktopBuild = {
  os: DesktopOs;
  fileName: string;
  url: string;
  sizeBytes: number;
};

export type DesktopReleaseResult =
  | {
      status: "ok";
      version: string;
      publishedAt: string | null;
      builds: DesktopBuild[];
    }
  | { status: "none" }
  | { status: "error"; message: string };

/** Maps a release asset file name to the operating system it targets. */
export function osFromAssetName(name: string): DesktopOs | null {
  const lower = name.toLowerCase();
  if (!/\.(zip|tar\.gz|tgz|exe|dmg|appimage)$/.test(lower)) return null;
  if (lower.includes("win32") || lower.includes("windows") || lower.endsWith(".exe")) {
    return "windows";
  }
  if (lower.includes("darwin") || lower.includes("mac") || lower.endsWith(".dmg")) return "mac";
  if (lower.includes("linux") || lower.endsWith(".appimage")) return "linux";
  return null;
}

/** Best guess at the visitor's desktop platform. */
export function detectOs(): DesktopOs | null {
  if (typeof navigator === "undefined") return null;
  const source = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  if (source.includes("android") || source.includes("iphone") || source.includes("ipad")) {
    return null;
  }
  if (source.includes("win")) return "windows";
  if (source.includes("mac")) return "mac";
  if (source.includes("linux") || source.includes("x11")) return "linux";
  return null;
}
