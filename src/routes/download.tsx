import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Pause,
  Play,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { InstallButton } from "@/components/pwa/install-button";
import { useApkDownload } from "@/hooks/use-apk-download";
import { getLatestAndroidRelease } from "@/lib/apk/release.functions";
import { ANDROID_RELEASES_URL, formatBytes, formatReleaseDate } from "@/lib/apk/release";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download IMUSIC for Android — APK" },
      {
        name: "description",
        content:
          "Get the signed IMUSIC Android APK. Always the latest release, with version, size and install steps.",
      },
      { property: "og:title", content: "Download IMUSIC for Android" },
      {
        property: "og:description",
        content: "Install the IMUSIC Android app — signed APK, always the newest release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadPage,
});

function shaFrom(notes: string | null) {
  const match = notes?.match(/SHA-256:\s*`?([a-f0-9]{64})`?/i);
  return match?.[1] ?? null;
}

function DownloadPage() {
  const fetchRelease = useServerFn(getLatestAndroidRelease);
  const { data, isPending, refetch, isFetching } = useQuery({
    queryKey: ["android-release"],
    queryFn: () => fetchRelease(),
    staleTime: 10 * 60 * 1000,
  });
  const release = data?.status === "ok" ? data.release : null;
  const download = useApkDownload(
    release
      ? {
          version: release.version,
          apkUrl: release.apkUrl,
          apkName: release.apkName,
          sizeBytes: release.sizeBytes,
        }
      : null,
  );


  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="label-mono">Android</p>
          <h1 className="text-3xl">Download IMUSIC</h1>
          <p className="text-sm text-muted-foreground">
            The Android app is a signed APK built from this exact project. Your library, playlists
            and playback stay in sync with the web app.
          </p>
        </header>

        <section className="surface-panel flex flex-col gap-5 p-6" aria-live="polite">
          {isPending ? (
            <div className="flex flex-col gap-3">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-surface-raised" />
              <div className="h-3 w-48 animate-pulse rounded bg-surface-raised" />
            </div>
          ) : data?.status === "ok" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">
                  v{data.release.version}
                </span>
                <span className="text-xs text-muted-foreground">
                  Released {formatReleaseDate(data.release.publishedAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(data.release.sizeBytes)}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {download.active ? (
                    <button
                      type="button"
                      onClick={download.pause}
                      aria-label="Pause the APK download"
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Pause className="size-4" aria-hidden="true" />
                      Pause download
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void download.start()}
                      aria-label={
                        download.resumable
                          ? `Resume downloading IMUSIC version ${data.release.version} APK`
                          : `Download IMUSIC version ${data.release.version} APK`
                      }
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {download.resumable ? (
                        <Play className="size-4" aria-hidden="true" />
                      ) : (
                        <Download className="size-4" aria-hidden="true" />
                      )}
                      {download.resumable
                        ? `Resume download (${download.percent ?? 0}%)`
                        : "Download APK for Android"}
                    </button>
                  )}
                  {(download.active || download.resumable) && (
                    <button
                      type="button"
                      onClick={() => void download.cancel()}
                      aria-label="Cancel download and discard saved progress"
                      className="flex size-12 items-center justify-center rounded-lg border border-border transition-colors hover:border-primary"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {(download.active || download.resumable || download.phase === "error") && (
                  <>
                    <div
                      role="progressbar"
                      aria-label="APK download progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={download.percent ?? undefined}
                      className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          download.phase === "error" ? "bg-destructive" : "bg-primary"
                        }`}
                        style={{ width: `${download.percent ?? 0}%` }}
                      />
                    </div>
                    <p
                      className={`text-xs ${download.phase === "error" ? "text-destructive" : "text-muted-foreground"}`}
                      role="status"
                      aria-live="polite"
                    >
                      {download.phase === "error"
                        ? (download.error ?? "Download interrupted — your progress is saved.")
                        : download.phase === "preparing"
                          ? "Preparing download…"
                          : download.phase === "assembling"
                            ? "Finishing up…"
                            : `${formatBytes(download.progress.receivedBytes)} of ${formatBytes(
                                download.progress.totalBytes,
                              )} · ${download.percent ?? 0}%`}
                    </p>
                  </>
                )}

                <p className="text-xs text-muted-foreground">
                  Downloads resume automatically if your connection drops — progress is kept on this
                  device.
                </p>
              </div>


              {shaFrom(data.release.notes) ? (
                <p className="flex items-start gap-2 break-all text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  SHA-256 {shaFrom(data.release.notes)}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold">
                {data?.status === "error"
                  ? "Couldn't check for the latest APK"
                  : "No Android build published yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data?.status === "error"
                  ? "GitHub didn't respond. Try again, or browse the releases page directly."
                  : "The APK appears here as soon as the first release is published. In the meantime you can install IMUSIC straight from your browser."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm transition-colors hover:border-primary"
                >
                  <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
                  Check again
                </button>
                <a
                  href={ANDROID_RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm transition-colors hover:border-primary"
                >
                  <ExternalLink className="size-4" />
                  Releases page
                </a>
                <InstallButton className="h-10 px-4 text-sm" />
              </div>
            </div>
          )}
        </section>

        <section className="surface-panel flex flex-col gap-4 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="size-4 text-primary" />
            How to install
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>Download the APK on your Android phone.</li>
            <li>
              Open it. Android will ask to allow installs from this source — turn that on for your
              browser or file manager.
            </li>
            <li>Tap Install, then open IMUSIC and sign in.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Every release is signed with the same key, so new versions install straight over the old
            one without uninstalling.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
