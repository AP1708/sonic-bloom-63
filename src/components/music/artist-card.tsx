import { Link } from "@tanstack/react-router";
import { Artwork } from "./artwork";
import { cn } from "@/lib/utils";

/**
 * Round avatar card. Round artwork is how YouTube Music distinguishes artists
 * from albums and playlists.
 *
 * With `onPlay` the card becomes a button (used for discovery artists that
 * don't have a local catalog page — tapping starts their radio instead).
 */
export function ArtistCard({
  id,
  name,
  caption,
  imageUrl,
  onPlay,
  isNew,
  index = 0,
}: {
  id: string;
  name: string;
  caption?: string;
  imageUrl?: string | null;
  onPlay?: () => void;
  /** Marks an artist surfaced by the latest discovery refresh. */
  isNew?: boolean;
  index?: number;
}) {
  const inner = (
    <>
      <div className="lift-on-hover relative w-full">
        <Artwork
          seed={id}
          src={imageUrl ?? undefined}
          alt={`${name} artwork`}
          className="aspect-square w-full"
          rounded="rounded-full"
        />
        {isNew && (
          <span className="fresh-pill label-mono pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground shadow">
            New
          </span>
        )}
      </div>
      <div className="flex w-full flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{name}</p>
        {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
      </div>
    </>
  );

  const className = cn(
    "group flex w-32 shrink-0 snap-start flex-col items-center gap-3 text-center sm:w-36",
    isNew && "card-enter",
  );
  const style = isNew ? { animationDelay: `${Math.min(index, 8) * 40}ms` } : undefined;

  if (onPlay) {
    return (
      <button
        type="button"
        onClick={onPlay}
        className={className}
        style={style}
        aria-label={`Play ${name}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link to="/artists/$artistId" params={{ artistId: id }} className={className}>
      {inner}
    </Link>
  );
}
