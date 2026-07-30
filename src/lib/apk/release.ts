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
