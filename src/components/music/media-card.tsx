import { Link } from "@tanstack/react-router";
import { Artwork, PlayOverlay, SourceTag } from "./artwork";
import type { Collection } from "@/lib/music/types";

interface MediaCardProps {
  collection: Collection;
  playing?: boolean;
  onPlay: () => void;
}

export function MediaCard({ collection, playing, onPlay }: MediaCardProps) {
  return (
    <article className="group flex flex-col gap-3">
      <div className="lift-on-hover relative">
        <Artwork
          seed={collection.id}
          src={collection.artworkUrl}
          alt={`${collection.title} artwork`}
          className="aspect-square w-full"
        />
        <PlayOverlay playing={Boolean(playing)} onClick={onPlay} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="truncate text-sm font-medium">{collection.title}</p>
        <div className="flex items-center gap-2">
          <p className="truncate text-xs text-muted-foreground">{collection.subtitle}</p>
          <SourceTag source={collection.source} />
        </div>
      </div>
    </article>
  );
}

export function Shelf({
  title,
  caption,
  viewAllTo,
  children,
}: {
  title: string;
  caption?: string;
  viewAllTo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
        <div>
          {caption && <p className="label-mono mb-1">{caption}</p>}
          <h2 className="text-xl">{title}</h2>
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} className="label-mono text-primary hover:opacity-80">
            View all
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}
