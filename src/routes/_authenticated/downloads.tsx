import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  Check,
  Loader2,
  Pin,
  RefreshCw,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Artwork, SourceTag } from "@/components/music/artwork";
import { EmptyState } from "@/components/music/track-row";
import { usePlayer } from "@/components/player/player-provider";
import { useOffline } from "@/hooks/use-offline";
import { useSession } from "@/hooks/use-session";
import { formatBytes, STORAGE_PRESETS } from "@/lib/offline/settings";
import type { OfflineEntry } from "@/lib/offline/store";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads & offline mix — Sonance" },
      {
        name: "description",
        content:
          "Keep an offline mix that refreshes itself from your listening history and favourite artists.",
      },
      { property: "og:title", content: "Downloads & offline mix — Sonance" },
      {
        property: "og:description",
        content: "Smart downloads that follow your taste, plus everything you've saved by hand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const offline = useOffline();
  const { user } = useSession();
  const player = usePlayer();
  const { settings, progress } = offline;

  const playable = offline.entries.filter((entry) => entry.hasAudio).map((entry) => entry.track);
  const running = progress.phase !== "idle" && progress.phase !== "done";

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="label-mono">Offline</p>
            <h1 className="text-4xl">Downloads</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Smart downloads keep a mix on this device that follows what you actually play — your
              favourite artists first, refreshed automatically. Only public-domain recordings can be
              stored as audio; Spotify and YouTube tracks are pinned but still stream.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!playable.length}
              onClick={() => player.playCollection(playable)}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Play offline
            </button>
            <button
              type="button"
              disabled={running || !user}
              onClick={() => void offline.refreshMix()}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh now
            </button>
          </div>
        </header>

        <section className="surface-panel flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-medium">Smart downloads</span>
            </div>
            <Switch
              checked={settings.enabled}
              label="Enable smart downloads"
              onChange={(value) => {
                offline.update({ enabled: value });
                if (value) void offline.refreshMix({ silent: true });
              }}
            />
          </div>

          <StorageMeter used={offline.usedBytes} limit={settings.limitBytes} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="label-mono">Storage limit</span>
              <div className="flex flex-wrap gap-2">
                {STORAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.bytes}
                    type="button"
                    onClick={() => offline.update({ limitBytes: preset.bytes })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      settings.limitBytes === preset.bytes
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="label-mono">Refresh every</span>
              <div className="flex flex-wrap gap-2">
                {[6, 12, 24, 48].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => offline.update({ refreshHours: hours })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      settings.refreshHours === hours
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm">
              <WifiOff className="size-4 text-muted-foreground" />
              <span>Only refresh on Wi-Fi</span>
            </div>
            <Switch
              checked={settings.wifiOnly}
              label="Only refresh on Wi-Fi"
              onChange={(value) => offline.update({ wifiOnly: value })}
            />
          </div>

          {running ? (
            <p className="label-mono">
              {progress.phase === "downloading"
                ? `Downloading ${progress.completed + 1}/${progress.total} · ${progress.currentTitle ?? ""}`
                : progress.phase === "planning"
                  ? "Working out what you'll want offline…"
                  : "Tidying up…"}
            </p>
          ) : settings.lastRunAt ? (
            <p className="label-mono">
              Last refreshed {new Date(settings.lastRunAt).toLocaleString()}
            </p>
          ) : null}
        </section>

        <Section
          title="Your offline mix"
          caption="Chosen automatically from your listening history"
          entries={offline.smart}
          emptyTitle="No smart downloads yet"
          emptyDescription="Turn smart downloads on and play a few songs — the mix builds itself from there."
          onRemove={offline.remove}
          onKeep={offline.keep}
          onPlay={(entry) => player.playTrack(entry.track, offline.smart.map((item) => item.track))}
        />

        <Section
          title="Saved by you"
          caption="Downloads you added by hand — never removed automatically"
          entries={offline.manual}
          emptyTitle="Nothing saved manually"
          emptyDescription="Use the ⋯ menu on any track and choose “Save offline”."
          onRemove={offline.remove}
          onPlay={(entry) => player.playTrack(entry.track, offline.manual.map((item) => item.track))}
        />
      </div>
    </AppShell>
  );
}

function StorageMeter({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min(100, limit ? (used / limit) * 100 : 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatBytes(used)} used</span>
        <span>{formatBytes(limit)} limit</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-surface-raised",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-4 rounded-full bg-background transition-all",
          checked ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

function Section({
  title,
  caption,
  entries,
  emptyTitle,
  emptyDescription,
  onRemove,
  onKeep,
  onPlay,
}: {
  title: string;
  caption: string;
  entries: OfflineEntry[];
  emptyTitle: string;
  emptyDescription: string;
  onRemove: (id: string) => void | Promise<void>;
  onKeep?: (id: string) => void | Promise<void>;
  onPlay: (entry: OfflineEntry) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl">{title}</h2>
        <span className="label-mono">{entries.length} tracks</span>
      </div>
      <p className="text-xs text-muted-foreground">{caption}</p>
      {entries.length ? (
        <div className="flex flex-col">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface"
            >
              <button type="button" onClick={() => onPlay(entry)} aria-label={`Play ${entry.track.title}`}>
                <Artwork
                  seed={entry.track.id}
                  src={entry.track.artworkUrl}
                  alt=""
                  className="size-10"
                  rounded="rounded-md"
                />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.track.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.track.artist} · {formatDuration(entry.track.durationSec)} ·{" "}
                  {entry.hasAudio ? formatBytes(entry.bytes) : "streams only"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SourceTag source={entry.track.source} />
                {entry.hasAudio ? (
                  <span
                    title="Available offline"
                    className="grid size-7 place-items-center rounded-md text-primary"
                  >
                    <Check className="size-4" />
                  </span>
                ) : (
                  <span
                    title="Pinned — audio still streams"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground"
                  >
                    <ArrowDownToLine className="size-4" />
                  </span>
                )}
                {onKeep ? (
                  <button
                    type="button"
                    onClick={() => void onKeep(entry.id)}
                    aria-label={`Keep ${entry.track.title}`}
                    title="Keep — stops this being auto-removed"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <Pin className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void onRemove(entry.id)}
                  aria-label={`Remove ${entry.track.title} from downloads`}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </section>
  );
}
