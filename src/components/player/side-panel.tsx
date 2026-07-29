import { useEffect, useMemo, useRef } from "react";
import { ExternalLink, FileQuestion, RefreshCw, X, Trash2 } from "lucide-react";
import { Artwork, SourceTag } from "@/components/music/artwork";
import { usePlayer } from "./player-provider";
import { useLyrics } from "@/hooks/use-lyrics";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music/types";

export function SidePanel() {
  const player = usePlayer();
  if (!player.panel) return null;

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-surface lg:flex">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="label-mono">{player.panel === "queue" ? "Play queue" : "Lyrics"}</h2>
        <button
          type="button"
          onClick={() => player.setPanel(player.panel)}
          aria-label="Close panel"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      {player.panel === "queue" ? <QueueList /> : <LyricsPane />}
    </aside>
  );
}

function QueueList() {
  const player = usePlayer();

  if (!player.queue.length) {
    return <p className="p-5 text-sm text-muted-foreground">The queue is empty. Play something to get started.</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="label-mono">{player.queue.length} tracks</span>
        <button
          type="button"
          onClick={player.clearQueue}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3" /> Clear
        </button>
      </div>
      <ul className="flex flex-col gap-1 px-2 pb-5">
        {player.queue.map((track, index) => (
          <li key={`${track.id}-${index}`}>
            <button
              type="button"
              onClick={() => player.playCollection(player.queue, index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-raised",
                index === player.index && "bg-surface-raised",
              )}
            >
              <Artwork seed={track.id} src={track.artworkUrl} alt="" className="size-9" rounded="rounded-md" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm",
                    index === player.index ? "text-primary" : "text-foreground",
                  )}
                >
                  {track.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatDuration(track.durationSec)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LyricsPane() {
  const player = usePlayer();
  const track = player.current;
  const lyrics = useLyrics(track ?? null);
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  const lines = lyrics.data?.lines ?? [];
  const synced = lyrics.data?.status === "synced";

  const activeIndex = useMemo(() => {
    if (!synced) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if ((lines[i].timeSec ?? 0) <= player.progressSec + 0.35) index = i;
      else break;
    }
    return index;
  }, [synced, lines, player.progressSec]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  if (!track) {
    return (
      <div className="flex-1 px-5 py-6">
        <p className="text-sm text-muted-foreground">Play a track to see lyrics here.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <p className="text-sm font-medium">{track.title}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{track.artist}</p>
        <SourceTag source={track.source} />
      </div>

      {lyrics.isLoading ? (
        <div className="mt-8 flex flex-col gap-3" aria-label="Loading lyrics">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              className="h-3 animate-pulse rounded bg-surface-raised"
              style={{ width: `${55 + ((index * 13) % 40)}%` }}
            />
          ))}
        </div>
      ) : null}

      {lyrics.isError ? (
        <LyricsFallback
          track={track}
          heading="Couldn't reach the lyrics service"
          body="The connection failed — you can retry, or open the source recording."
          onRetry={() => lyrics.refetch()}
        />
      ) : null}

      {lyrics.data?.status === "none" ? (
        <LyricsFallback
          track={track}
          heading="No lyrics found"
          body="This vintage recording isn't in the lyrics database yet. Many golden-era film songs are still uncatalogued."
          onRetry={() => lyrics.refetch()}
        />
      ) : null}

      {lines.length ? (
        <>
          <div className="mt-6 flex flex-col gap-3 pb-10">
            {lines.map((line, index) => (
              <p
                key={`${index}-${line.timeSec ?? "x"}`}
                ref={index === activeIndex ? activeRef : undefined}
                className={cn(
                  "text-sm leading-relaxed transition-colors",
                  line.text ? "" : "h-2",
                  !synced
                    ? "text-muted-foreground"
                    : index === activeIndex
                      ? "font-medium text-primary"
                      : index < activeIndex
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground",
                )}
              >
                {line.text}
              </p>
            ))}
          </div>
          <p className="label-mono border-t border-border pt-3 text-[10px] text-muted-foreground">
            {synced ? "Time-synced" : "Plain"} lyrics via {lyrics.data?.provider}
            {lyrics.data?.matchedTitle ? ` · matched “${lyrics.data.matchedTitle}”` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}

function LyricsFallback({
  track,
  heading,
  body,
  onRetry,
}: {
  track: Track;
  heading: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileQuestion className="size-4 text-primary" />
        {heading}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary"
        >
          <RefreshCw className="size-3" /> Try again
        </button>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(`${track.title} ${track.artist} lyrics`)}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" /> Search the web
        </a>
        {track.externalUrl ? (
          <a
            href={track.externalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3" /> Source
          </a>
        ) : null}
      </div>
    </div>
  );
}
