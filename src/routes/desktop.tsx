import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Monitor, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { InstallButton } from "@/components/pwa/install-button";
import { formatBytes, formatReleaseDate } from "@/lib/apk/release";
import { getLatestDesktopRelease } from "@/lib/desktop/release.functions";
import {
  DESKTOP_RELEASES_URL,
  OS_HINT,
  OS_LABEL,
  detectOs,
  type DesktopOs,
} from "@/lib/desktop/release";

export const Route = createFileRoute("/desktop")({
  head: () => ({
    meta: [
      { title: "Download IMUSIC for desktop — Windows, macOS, Linux" },
      {
        name: "description",
        content:
          "Get the IMUSIC desktop app for Windows, macOS or Linux. Your library, playlists and playback stay in sync.",
      },
      { property: "og:title", content: "Download IMUSIC for desktop" },
      {
        property: "og:description",
        content: "IMUSIC in its own window on Windows, macOS and Linux.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesktopPage,
});

function DesktopPage() {
  const fetchRelease = useServerFn(getLatestDesktopRelease);
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["desktop-release"],
    queryFn: () => fetchRelease(),
    staleTime: 10 * 60 * 1000,
  });

  const [os, setOs] = useState<DesktopOs | null>(null);
  useEffect(() => setOs(detectOs()), []);

  const builds = data?.status === "ok" ? data.builds : [];
  const recommended = os ? builds.filter((build) => build.os === os) : [];
  const others = builds.filter((build) => !recommended.includes(build));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="label-mono">Desktop</p>
          <h1 className="text-3xl">IMUSIC for your computer</h1>
          <p className="text-sm text-muted-foreground">
            A dedicated IMUSIC window with its own icon and media keys. Everything stays in sync
            with the web app and your phone.
          </p>
        </header>

        <section className="surface-panel flex flex-col gap-5 p-6" aria-live="polite">
          {isPending ? (
            <div className="flex flex-col gap-3">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-surface-raised" />
            </div>
          ) : data?.status === "ok" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">
                  v{data.version}
                </span>
                <span className="text-xs text-muted-foreground">
                  Released {formatReleaseDate(data.publishedAt)}
                </span>
                {os ? (
                  <span className="text-xs text-muted-foreground">
                    Detected: {OS_LABEL[os]}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                {(recommended.length ? recommended : builds).map((build) => (
                  <a
                    key={build.fileName}
                    href={build.url}
                    className="flex items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary/5 p-4 transition-colors hover:border-primary"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">
                        Download for {OS_LABEL[build.os]}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {build.fileName} · {formatBytes(build.sizeBytes)}
                      </span>
                    </span>
                    <Download className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  </a>
                ))}
              </div>

              {recommended.length > 0 && others.length > 0 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Other systems
                  </summary>
                  <div className="mt-3 flex flex-col gap-2">
                    {others.map((build) => (
                      <a
                        key={build.fileName}
                        href={build.url}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm">{OS_LABEL[build.os]}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {build.fileName} · {formatBytes(build.sizeBytes)}
                          </span>
                        </span>
                        <Download className="size-4 shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold">
                {data?.status === "error"
                  ? "Couldn't check for the desktop app"
                  : "No desktop build published yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data?.status === "error"
                  ? "GitHub didn't respond. Try again, or browse the releases page directly."
                  : "The desktop packages appear here as soon as the first desktop release is published. Until then you can install IMUSIC from your browser — it opens in its own window too."}
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
                  href={DESKTOP_RELEASES_URL}
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
            <Monitor className="size-4 text-primary" />
            How to install
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>Download the package for your system.</li>
            <li>{os ? OS_HINT[os] : "Unzip it, then run the IMUSIC file inside the folder."}</li>
            <li>
              The first launch may warn that the app is from an unidentified developer — choose
              "Run anyway" (Windows) or right-click, Open (macOS).
            </li>
            <li>Sign in once and your library appears.</li>
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
