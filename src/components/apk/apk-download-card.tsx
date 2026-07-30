import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  Smartphone,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { getLatestAndroidRelease } from "@/lib/android/release.functions";
import { ANDROID_RELEASES_URL, formatBytes, formatReleaseDate } from "@/lib/android/release";

/**
 * Compact GitHub Releases–backed download card.
 * Handles loading, failure (with retry + toast) and the happy path.
 */
export function ApkDownloadCard({ className }: { className?: string }) {
  const fetchRelease = useServerFn(getLatestAndroidRelease);
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["android-release"],
    queryFn: () => fetchRelease(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // A failed lookup can be either a thrown error or a typed { status: "error" }.
  const failed = Boolean(error) || data?.status === "error";
  const failureMessage =
    (data?.status === "error" ? data.message : null) ??
    (error instanceof Error ? error.message : null) ??
    "Could not reach GitHub Releases.";

  // Toast once per failure transition, never on every render.
  const notified = useRef(false);
  useEffect(() => {
    if (failed && !isFetching && !notified.current) {
      notified.current = true;
      toast.error("Couldn't load the Android release", {
        description: failureMessage,
        action: { label: "Retry", onClick: () => void refetch() },
      });
    }
    if (!failed) notified.current = false;
  }, [failed, isFetching, failureMessage, refetch]);

  const [downloadError, setDownloadError] = useState(false);

  const handleDownload = (url: string) => {
    try {
      setDownloadError(false);
      window.location.href = url;
    } catch {
      setDownloadError(true);
      toast.error("Download failed to start", {
        description: "Open the releases page and download the APK manually.",
        action: {
          label: "Open releases",
          onClick: () => window.open(ANDROID_RELEASES_URL, "_blank", "noopener"),
        },
      });
    }
  };

  return (
    <section
      aria-labelledby="apk-download-heading"
      aria-busy={isPending}
      className={`surface-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised ${
            failed ? "text-destructive" : "text-primary"
          }`}
        >
          {failed ? (
            <AlertTriangle className="size-5" aria-hidden />
          ) : (
            <Smartphone className="size-5" aria-hidden />
          )}
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="apk-download-heading" className="text-base font-medium">
            Get IMUSIC for Android
          </h2>
          {isPending ? (
            <span
              className="mt-1 h-3 w-44 animate-pulse rounded bg-surface-raised"
              role="status"
              aria-label="Checking for the latest release"
            />
          ) : (
            <p
              className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`}
              role={failed ? "alert" : undefined}
            >
              {failed
                ? failureMessage
                : downloadError
                  ? "Download didn't start — try the releases page."
                  : data?.status === "ok"
                    ? `v${data.release.version} · ${formatBytes(data.release.sizeBytes)} · ${formatReleaseDate(
                        data.release.publishedAt,
                      )}`
                    : "Signed APK published on GitHub Releases."}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isPending ? (
          <span className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading…
          </span>
        ) : failed ? (
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        ) : data?.status === "ok" ? (
          <button
            type="button"
            onClick={() => handleDownload(data.release.apkUrl)}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="size-4" aria-hidden />
            Download APK
          </button>
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
