import { Link } from "@tanstack/react-router";
import { Artwork } from "./artwork";

/**
 * Round avatar card. Round artwork is how YouTube Music distinguishes artists
 * from albums and playlists.
 */
export function ArtistCard({
  id,
  name,
  caption,
}: {
  id: string;
  name: string;
  caption?: string;
}) {
  return (
    <Link
      to="/artists/$artistId"
      params={{ artistId: id }}
      className="group flex w-32 shrink-0 snap-start flex-col items-center gap-3 text-center sm:w-36"
    >
      <div className="lift-on-hover w-full">
        <Artwork
          seed={id}
          alt={`${name} artwork`}
          className="aspect-square w-full"
          rounded="rounded-full"
        />
      </div>
      <div className="flex w-full flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{name}</p>
        {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
      </div>
    </Link>
  );
}
