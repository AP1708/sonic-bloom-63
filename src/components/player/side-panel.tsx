import { X, Trash2 } from "lucide-react";
import { Artwork, SourceTag } from "@/components/music/artwork";
import { usePlayer } from "./player-provider";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      {track ? (
        <>
          <p className="text-sm font-medium">{track.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{track.artist}</p>
            <SourceTag source={track.source} />
          </div>
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Time-synced lyrics arrive once a lyrics provider is connected. Track metadata is already
            wired through the provider abstraction, so enabling a lyrics source is a drop-in change.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Play a track to see lyrics here.</p>
      )}
    </div>
  );
}
