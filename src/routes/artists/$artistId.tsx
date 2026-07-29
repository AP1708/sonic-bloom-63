import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Shuffle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Artwork } from "@/components/music/artwork";
import { TrackRow, TrackListHeader, EmptyState } from "@/components/music/track-row";
import { usePlayer } from "@/components/player/player-provider";
import { loadFullCatalog } from "@/lib/music/full-catalog";
import { useLikedSongs, useToggleLike } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/artists/$artistId")({
  head: ({ params }) => {
    const name = params.artistId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return {
      meta: [
        { title: `${name} songs — Sonance` },
        {
          name: "description",
          content: `Stream every ${name} recording in the Sonance public-domain archive, in full and without a login.`,
        },
        { property: "og:title", content: `${name} — Sonance` },
        { property: "og:description", content: `All ${name} recordings, streaming in full.` },
        { property: "og:type", content: "music.musician" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ArtistPage,
});

function ArtistPage() {
  const { artistId } = Route.useParams();
  const player = usePlayer();
  const { user } = useSession();
  const { data: liked } = useLikedSongs(user?.id);
  const toggleLike = useToggleLike(user?.id);

  const catalog = useQuery({
    queryKey: ["full-catalog"],
    queryFn: loadFullCatalog,
    staleTime: Infinity,
  });

  const tracks = catalog.data?.byArtist.get(artistId) ?? [];
  const name = tracks[0]?.artist ?? artistId.replace(/-/g, " ");
  const isLiked = (id: string) => Boolean(liked?.some((track) => track.id === id));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
          <Artwork
            seed={artistId}
            alt={`${name} artwork`}
            className="size-40 shrink-0"
            rounded="rounded-full"
          />
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Artist · public-domain archive
            </p>
            <h1 className="text-4xl capitalize">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {tracks.length.toLocaleString()} recordings, every one streaming in full.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!tracks.length}
                onClick={() => player.playCollection(tracks, 0)}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                <Play className="size-4" /> Play all
              </button>
              <button
                type="button"
                disabled={!tracks.length}
                onClick={() =>
                  player.playCollection(tracks, Math.floor(Math.random() * tracks.length))
                }
                className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm disabled:opacity-40"
              >
                <Shuffle className="size-4" /> Shuffle
              </button>
              <Link to="/artists" className="text-sm text-muted-foreground hover:text-foreground">
                All artists
              </Link>
            </div>
          </div>
        </header>

        {catalog.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading catalog…
          </div>
        ) : null}

        {!catalog.isLoading && !tracks.length ? (
          <EmptyState title="No recordings found" description="This artist isn't in the archive." />
        ) : null}

        {tracks.length ? (
          <section className="flex flex-col gap-1">
            <TrackListHeader />
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                isCurrent={player.current?.id === track.id}
                isPlaying={player.isPlaying}
                liked={isLiked(track.id)}
                onPlay={() => player.playTrack(track, tracks)}
                onLike={user ? () => toggleLike.mutate(track) : undefined}
              />
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
