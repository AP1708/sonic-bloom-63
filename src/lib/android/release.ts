/** GitHub repository that publishes the IMUSIC Android releases. */
export const ANDROID_RELEASE_REPO = "Ayush1708/imusic";

export const ANDROID_RELEASES_URL = `https://github.com/${ANDROID_RELEASE_REPO}/releases`;

export type AndroidRelease = {
  version: string;
  publishedAt: string | null;
  apkUrl: string;
  apkName: string;
  sizeBytes: number;
  notes: string | null;
};

export type AndroidReleaseResult =
  | { status: "ok"; release: AndroidRelease }
  | { status: "none" }
  | { status: "error"; message: string };

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
