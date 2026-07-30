import { Link } from "@tanstack/react-router";
import { Artwork } from "./artwork";

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
}: {
  id: string;
  name: string;
  caption?: string;
  imageUrl?: string | null;
  onPlay?: () => void;
}) {
  const inner = (
    <>
      <div className="lift-on-hover w-full">
        <Artwork
          seed={id}
          src={imageUrl ?? undefined}
          alt={`${name} artwork`}
          className="aspect-square w-full"
          rounded="rounded-full"
        />
      </div>
      <div className="flex w-full flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{name}</p>
        {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
      </div>
    </>
  );

  const className =
    "group flex w-32 shrink-0 snap-start flex-col items-center gap-3 text-center sm:w-36";

  if (onPlay) {
    return (
      <button type="button" onClick={onPlay} className={className} aria-label={`Play ${name}`}>
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
