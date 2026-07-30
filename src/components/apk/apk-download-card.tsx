import { useEffect, useId, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  const headingId = useId();
  const statusId = useId();

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isPending}
      aria-live={failed ? "polite" : undefined}
      aria-atomic={failed ? "true" : undefined}
      className={`surface-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised ${
            failed ? "text-destructive" : "text-primary"
          }`}
          aria-hidden="true"
        >
          {failed ? (
            <AlertTriangle className="size-5" aria-hidden="true" />
          ) : (
            <Smartphone className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-base font-medium">
            Get IMUSIC for Android
          </h2>
          {isPending ? (
            <div className="flex flex-col gap-1.5" aria-hidden="true">
              <Skeleton className="mt-1 h-3 w-44" />
              <Skeleton className="h-2 w-24" />
            </div>
          ) : (
            <p
              id={statusId}
              className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`}
              role={failed ? "alert" : undefined}
              aria-live={failed ? "assertive" : undefined}
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
          {isPending && (
            <span className="sr-only" role="status">
              Checking for the latest release
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isPending ? (
          <Button
            variant="outline"
            size="default"
            disabled
            aria-label="Loading release information"
            aria-describedby={statusId}
            className="h-10"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </Button>
        ) : failed ? (
          <Button
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={isFetching ? "Retrying release lookup" : "Retry loading release"}
            aria-describedby={statusId}
            className="h-10"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        ) : data?.status === "ok" ? (
          <Button
            onClick={() => handleDownload(data.release.apkUrl)}
            aria-label={`Download IMUSIC version ${data.release.version} APK`}
            aria-describedby={statusId}
            className="h-10"
          >
            <Download className="size-4" aria-hidden="true" />
            Download APK
          </Button>
        ) : (
          <Button
            variant="outline"
            asChild
            aria-label="View all releases on GitHub"
            aria-describedby={statusId}
            className="h-10"
          >
            <a
              href={ANDROID_RELEASES_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              View releases
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          asChild
          aria-label="More Android download details"
          className="h-10"
        >
          <Link to="/download">Details</Link>
        </Button>
      </div>
    </section>
  );
}
