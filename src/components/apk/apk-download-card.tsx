import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Smartphone, ExternalLink } from "lucide-react";
import { getLatestAndroidRelease } from "@/lib/android/release.functions";
import { ANDROID_RELEASES_URL, formatBytes, formatReleaseDate } from "@/lib/android/release";

/**
 * Compact GitHub Releases–backed download card.
 * Shows the latest signed APK with a single-tap download button.
 */
export function ApkDownloadCard({ className }: { className?: string }) {
  const fetchRelease = useServerFn(getLatestAndroidRelease);
  const { data, isPending } = useQuery({
    queryKey: ["android-release"],
    queryFn: () => fetchRelease(),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <section
      aria-labelledby="apk-download-heading"
      className={`surface-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-primary">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="apk-download-heading" className="text-base font-medium">
            Get IMUSIC for Android
          </h2>
          <p className="text-xs text-muted-foreground">
            {isPending
              ? "Checking for the latest release…"
              : data?.status === "ok"
                ? `v${data.release.version} · ${formatBytes(data.release.sizeBytes)} · ${formatReleaseDate(
                    data.release.publishedAt,
                  )}`
                : "Signed APK published on GitHub Releases."}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {data?.status === "ok" ? (
          <a
            href={data.release.apkUrl}
            download
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="size-4" aria-hidden />
            Download APK
          </a>
        ) : (
          <a
            href={ANDROID_RELEASES_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-surface-raised"
          >
            <ExternalLink className="size-4" aria-hidden />
            View releases
          </a>
        )}
        <Link
          to="/download"
          className="flex h-10 items-center rounded-lg border border-border px-3 text-sm transition-colors hover:bg-surface-raised"
        >
          Details
        </Link>
      </div>
    </section>
  );
}
