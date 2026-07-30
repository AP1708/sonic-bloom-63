import { Artwork, PlayOverlay, SourceTag } from "./artwork";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music/types";

/**
 * Square media tile used across the home rails. Matches the YouTube Music
 * home-feed card: artwork, hover play, title, then a dim secondary line.
 */
export function SongCard({
  track,
  playing,
  onPlay,
  width = "w-40 sm:w-44",
  subtitle,
}: {
  track: Track;
  playing?: boolean;
  onPlay: () => void;
  width?: string;
  subtitle?: string;
}) {
  return (
    <article className={cn("group flex shrink-0 snap-start flex-col gap-2", width)}>
      <div className="lift-on-hover relative">
        <Artwork
          seed={track.id}
          src={track.artworkUrl}
          alt={`${track.title} artwork`}
          className="aspect-square w-full"
        />
        <PlayOverlay playing={Boolean(playing)} onClick={onPlay} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <div className="flex items-center gap-2">
          <p className="truncate text-xs text-muted-foreground">{subtitle ?? track.artist}</p>
          <SourceTag source={track.source} />
        </div>
      </div>
    </article>
  );
}

/**
 * "Mixed for you" tile — a stacked artwork treatment so mixes read as a set of
 * songs rather than a single release.
 */
export function MixCard({
  id,
  title,
  subtitle,
  playing,
  onPlay,
}: {
  id: string;
  title: string;
  subtitle: string;
  playing?: boolean;
  onPlay: () => void;
}) {
  return (
    <article className="group flex w-44 shrink-0 snap-start flex-col gap-2 sm:w-48">
      <div className="relative pt-3">
        <div className="absolute inset-x-4 top-0 h-3 rounded-t-lg bg-surface-raised/70" />
        <div className="absolute inset-x-2 top-1.5 h-3 rounded-t-lg bg-surface-raised" />
        <div className="lift-on-hover relative">
          <Artwork seed={id} alt={`${title} mix artwork`} className="aspect-square w-full" />
          <PlayOverlay playing={Boolean(playing)} onClick={onPlay} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </article>
  );
}
