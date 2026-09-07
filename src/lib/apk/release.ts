import type { Abi } from "@/lib/apk/device";

/** GitHub repository that publishes the IMUSIC Android releases. */
export const ANDROID_RELEASE_REPO = "Ayush1708/imusic";

export const ANDROID_RELEASES_URL = `https://github.com/${ANDROID_RELEASE_REPO}/releases`;

/** One downloadable APK build, tied to a CPU architecture. */
export type ApkVariant = {
  abi: Abi;
  apkUrl: string;
  apkName: string;
  sizeBytes: number;
};

export type AndroidRelease = {
  version: string;
  publishedAt: string | null;
  /** Default (universal, or the only) build — kept for simple one-tap flows. */
  apkUrl: string;
  apkName: string;
  sizeBytes: number;
  notes: string | null;
  /** Every APK asset in the release, one per architecture. */
  variants: ApkVariant[];
};

export type AndroidReleaseResult =
  | { status: "ok"; release: AndroidRelease }
  | { status: "none" }
  | { status: "error"; message: string };

/** Picks the build matching the device, falling back to universal then anything. */
export function pickVariant(variants: ApkVariant[], abi: Abi): ApkVariant | null {
  return (
    variants.find((variant) => variant.abi === abi) ??
    variants.find((variant) => variant.abi === "universal") ??
    variants[0] ??
    null
  );
}


export function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function formatReleaseDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "4.2 MB/s" style transfer rate. */
export function formatRate(bytesPerSecond: number | null) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return null;
  const mb = bytesPerSecond / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${Math.round(bytesPerSecond / 1024)} KB/s`;
}

/** "about 1 min 20 s left" style remaining time. */
export function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${Math.max(total, 1)} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}
