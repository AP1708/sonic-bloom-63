import { Heart, MoreHorizontal, Play, Plus } from "lucide-react";
import { Artwork, Equalizer, SourceTag } from "./artwork";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music/types";

interface TrackRowProps {
  track: Track;
  index: number;
  isCurrent?: boolean;
  isPlaying?: boolean;
  liked?: boolean;
  showArtwork?: boolean;
  onPlay: () => void;
  onLike?: () => void;
  onAdd?: () => void;
}

export function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  liked,
  showArtwork = true,
  onPlay,
  onLike,
  onAdd,
}: TrackRowProps) {
  return (
    <div
      className={cn(
        "group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 rounded-lg px-3 py-2 transition-colors sm:grid-cols-[2.5rem_1fr_8rem_5rem_auto]",
        isCurrent ? "bg-surface" : "hover:bg-surface",
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
        className="grid size-8 place-items-center rounded-md font-mono text-xs text-muted-foreground"
      >
        {isCurrent && isPlaying ? (
          <Equalizer />
        ) : (
          <>
            <span className="group-hover:hidden">{String(index + 1).padStart(2, "0")}</span>
            <Play className="hidden size-4 text-foreground group-hover:block" />
          </>
        )}
      </button>

      <div className="flex min-w-0 items-center gap-3">
        {showArtwork && (
          <Artwork seed={track.id} src={track.artworkUrl} alt="" className="size-10 shrink-0" rounded="rounded-md" />
        )}
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-medium", isCurrent && "text-primary")}>
            {track.title}
          </p>
          <p className="truncate text-xs text-muted-foreground sm:hidden">{track.artist}</p>
        </div>
      </div>

      <p className="hidden truncate text-xs text-muted-foreground sm:block">{track.artist}</p>
      <div className="hidden sm:block">
        <SourceTag source={track.source} />
      </div>

      <div className="flex items-center gap-1">
        {onLike && (
          <button
            type="button"
            onClick={onLike}
            aria-label={liked ? "Remove from liked songs" : "Save to liked songs"}
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
              liked && "text-primary hover:text-primary",
            )}
          >
            <Heart className={cn("size-4", liked && "fill-current")} />
          </button>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add to queue"
            className="grid size-8 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <Plus className="size-4" />
          </button>
        )}
        <span className="w-12 text-right font-mono text-xs text-muted-foreground">
          {formatDuration(track.durationSec)}
        </span>
      </div>
    </div>
  );
}

export function TrackListHeader() {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] gap-4 border-b border-border px-3 pb-2 sm:grid-cols-[2.5rem_1fr_8rem_5rem_auto]">
      <span className="label-mono">#</span>
      <span className="label-mono">Title</span>
      <span className="label-mono hidden sm:block">Artist</span>
      <span className="label-mono hidden sm:block">Source</span>
      <span className="label-mono text-right">Time</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <MoreHorizontal className="size-5 text-muted-foreground" />
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
