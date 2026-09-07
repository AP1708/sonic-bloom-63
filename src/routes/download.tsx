import { useEffect, useState } from "react";
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
import {
  ANDROID_RELEASES_URL,
  formatBytes,
  formatDuration,
  formatRate,
  formatReleaseDate,
  pickVariant,
} from "@/lib/apk/release";
import { ABI_HINT, ABI_LABEL, detectAbi, type Abi } from "@/lib/apk/device";


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

function shaFrom(notes: string | null, fileName?: string) {
  if (!notes) return null;
  if (fileName) {
    // Release notes list one "`file.apk` — SHA-256: `hash`" line per build.
    const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const perFile = notes.match(
      new RegExp(`${escaped}[^\\n]*?SHA-256:\\s*\`?([a-f0-9]{64})\`?`, "i"),
    );
    if (perFile?.[1]) return perFile[1];
  }
  const match = notes.match(/SHA-256:\s*`?([a-f0-9]{64})`?/i);
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

  // Detect the phone's CPU architecture so the matching (smaller) build is preselected.
  const [detectedAbi, setDetectedAbi] = useState<Abi | null>(null);
  const [chosenAbi, setChosenAbi] = useState<Abi | null>(null);
  useEffect(() => {
    let cancelled = false;
    void detectAbi().then((abi) => {
      if (!cancelled) setDetectedAbi(abi);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const variants = release?.variants ?? [];
  const recommended = detectedAbi ? pickVariant(variants, detectedAbi) : null;
  const selected =
    (chosenAbi ? variants.find((variant) => variant.abi === chosenAbi) : null) ??
    recommended ??
    (release
      ? { abi: "universal" as Abi, apkUrl: release.apkUrl, apkName: release.apkName, sizeBytes: release.sizeBytes }
      : null);

  const expectedSha = shaFrom(release?.notes ?? null, selected?.apkName);

  const download = useApkDownload(
    release && selected
      ? {
          // Key the resumable store per build so switching variants keeps both.
          version: `${release.version}-${selected.abi}`,
          apkUrl: selected.apkUrl,
          apkName: selected.apkName,
          sizeBytes: selected.sizeBytes,
          sha256: expectedSha,
        }
      : null,
  );

  // One human-readable line: bytes, percent, live speed and time remaining.
  const rate = formatRate(download.speed);
  const eta = formatDuration(download.remainingSeconds);
  const statusLine =
    download.phase === "preparing"
      ? "Preparing download…"
      : download.phase === "assembling"
        ? "Finishing up…"
        : download.phase === "verifying"
          ? "Verifying the file…"
          : download.phase === "paused"
            ? `Paused · ${formatBytes(download.progress.receivedBytes)} of ${formatBytes(
                download.progress.totalBytes,
              )} · ${download.percent ?? 0}%`
            : [
                `${formatBytes(download.progress.receivedBytes)} of ${formatBytes(
                  download.progress.totalBytes,
                )}`,
                `${download.percent ?? 0}%`,
                rate,
                eta ? `${eta} left` : null,
              ]
                .filter(Boolean)
                .join(" · ");


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
                  {formatBytes(selected?.sizeBytes ?? data.release.sizeBytes)}
                </span>
                {selected ? (
                  <span className="text-xs text-muted-foreground">{ABI_LABEL[selected.abi]}</span>
                ) : null}
              </div>

              {variants.length > 1 ? (
                <fieldset className="flex flex-col gap-3" disabled={download.active}>
                  <legend className="text-xs text-muted-foreground">
                    {recommended
                      ? `Matched to your device: ${ABI_LABEL[recommended.abi]}`
                      : "Choose the build for your device"}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Android build">
                    {variants.map((variant) => {
                      const active = selected?.abi === variant.abi;
                      return (
                        <button
                          key={variant.abi}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setChosenAbi(variant.abi)}
                          className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                            active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="flex w-full items-center justify-between gap-2 text-sm">
                            {ABI_LABEL[variant.abi]}
                            {recommended?.abi === variant.abi ? (
                              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                                Recommended
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(variant.sizeBytes)} · {ABI_HINT[variant.abi]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}


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
                      aria-label={`APK download progress: ${download.percent ?? 0}%${
                        statusLine ? `, ${statusLine}` : ""
                      }`}
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
                        : statusLine}
                    </p>
                  </>
                )}

                {download.completed && (
                  <div
                    className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3"
                    role="status"
                    aria-live="polite"
                  >
                    <p className="flex items-center gap-2 text-xs text-primary">
                      <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                      {download.verified
                        ? "Download complete and checksum verified."
                        : "Download complete. No published checksum, so the file couldn't be verified."}
                    </p>
                    <button
                      type="button"
                      onClick={download.openInstallPage}
                      className="self-start rounded-lg border border-primary px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
                    >
                      Open install page
                    </button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Downloads resume automatically if your connection drops — progress is kept on this
                  device.
                </p>

              </div>


              {shaFrom(data.release.notes, selected?.apkName) ? (
                <p className="flex items-start gap-2 break-all text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  SHA-256 {shaFrom(data.release.notes, selected?.apkName)}

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

        <section
          id="install"
          className="surface-panel flex scroll-mt-24 flex-col gap-5 p-6 target:ring-1 target:ring-primary"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="size-4 text-primary" />
            Installing on your phone, step by step
          </h2>

          <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">Tap Download above</span> and wait for the bar to
              reach 100% and say the file was verified.
            </li>
            <li>
              <span className="text-foreground">Open the file.</span> Pull down your notifications
              and tap the finished download, or open Files → Downloads and tap the{" "}
              <code className="text-xs">.apk</code>.
            </li>
            <li>
              <span className="text-foreground">Allow installs from this app.</span> Android asks
              once. On Android 8 and newer: Settings → Apps → Special app access → Install unknown
              apps → pick your browser (usually Chrome) or Files → turn on "Allow from this source".
              Then come back and tap the file again.
            </li>
            <li>
              <span className="text-foreground">Tap Install</span>, wait a few seconds, then tap
              Open.
            </li>
            <li>
              <span className="text-foreground">Sign in</span> with the same account you use here
              and your playlists, likes and downloads are already there.
            </li>
          </ol>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold">If Play Protect shows a warning</h3>
            <p className="text-xs text-muted-foreground">
              That warning appears for every app installed outside the Play Store, including this
              one. Tap "More details" then "Install anyway". Only install the file from this page —
              it's the one whose fingerprint is listed above.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="text-xs font-semibold">Checking the file is genuine</h3>
            <p className="text-xs text-muted-foreground">
              This page checks the downloaded file against the published SHA-256 fingerprint before
              telling you it's ready. If the check fails, the file is deleted automatically and you
              can simply download again.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Every release is signed with the same key, so new versions install straight over the old
            one without uninstalling.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
