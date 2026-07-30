import { Artwork, Equalizer } from "./artwork";
import { TrackMenu } from "./track-menu";
import { Carousel } from "./carousel";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music/types";

interface QuickPicksGridProps {
  tracks: Track[];
  currentId?: string;
  isPlaying?: boolean;
  likedIds: (id: string) => boolean;
  onPlay: (track: Track) => void;
  /** Rows stacked per horizontal page column. */
  rows?: number;
}

/**
 * The YouTube Music "Quick picks" block: compact track rows stacked N-per
 * column, with columns paging horizontally instead of the page growing taller.
 */
export function QuickPicksGrid({
  tracks,
  currentId,
  isPlaying,
  likedIds,
  onPlay,
  rows = 4,
}: QuickPicksGridProps) {
  const columns: Track[][] = [];
  for (let i = 0; i < tracks.length; i += rows) {
    columns.push(tracks.slice(i, i + rows));
  }

  return (
    <Carousel>
      {columns.map((column, index) => (
        <div
          key={index}
          className="flex w-[85vw] shrink-0 snap-start flex-col gap-1 sm:w-[24rem] lg:w-[26rem]"
        >
          {column.map((track) => (
            <QuickPickRow
              key={track.id}
              track={track}
              isCurrent={currentId === track.id}
              isPlaying={Boolean(isPlaying)}
              liked={likedIds(track.id)}
              onPlay={() => onPlay(track)}
            />
          ))}
        </div>
      ))}
    </Carousel>
  );
}

function QuickPickRow({
  track,
  isCurrent,
  isPlaying,
  liked,
  onPlay,
}: {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  liked: boolean;
  onPlay: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
        isCurrent ? "bg-surface" : "hover:bg-surface",
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
        className="relative shrink-0"
      >
        <Artwork seed={track.id} src={track.artworkUrl} alt="" className="size-12" rounded="rounded-md" />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center rounded-md bg-background/55 transition-opacity",
            isCurrent && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {isCurrent && isPlaying ? <Equalizer /> : <Play className="size-4" />}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", isCurrent && "text-primary")}>{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </p>
      </div>

      <TrackMenu track={track} liked={liked} />
    </div>
  );
}
