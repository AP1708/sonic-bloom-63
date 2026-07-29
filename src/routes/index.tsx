import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { MediaCard, Shelf } from "@/components/music/media-card";
import { TrackRow, TrackListHeader } from "@/components/music/track-row";
import { usePlayer } from "@/components/player/player-provider";
import { DEMO_SHELVES, DEMO_TRACKS, tracksForCollection } from "@/lib/music/catalog";
import { useLikedSongs, useRecentlyPlayed, useToggleLike } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";
import { greeting } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sonance — Stream music from Spotify and YouTube" },
      {
        name: "description",
        content:
          "Sonance unifies your Spotify and YouTube music in one dark, fast player with playlists, liked songs, and a synced queue.",
      },
      { property: "og:title", content: "Sonance — One player for Spotify and YouTube" },
      {
        property: "og:description",
        content: "Search, queue, and organise music from Spotify and YouTube in a single library.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const player = usePlayer();
  const { user } = useSession();
  const { data: liked } = useLikedSongs(user?.id);
  const { data: recent } = useRecentlyPlayed(user?.id);
  const toggleLike = useToggleLike(user?.id);

  const quickPicks = DEMO_TRACKS.slice(0, 6);
  const isLiked = (id: string) => Boolean(liked?.some((track) => track.id === id));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <header className="rise-in flex flex-col gap-2">
          <p className="label-mono">{new Date().toLocaleDateString(undefined, { weekday: "long" })}</p>
          <h1 className="text-4xl">{greeting()}</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Golden-era Indian recordings streaming in full, plus Spotify and YouTube in one queue.
          </p>
        </header>

        {recent && recent.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl">Jump back in</h2>
            <div className="flex flex-col">
              <TrackListHeader />
              {recent.slice(0, 5).map((track, index) => (
                <TrackRow
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  isCurrent={player.current?.id === track.id}
                  isPlaying={player.isPlaying}
                  liked={isLiked(track.id)}
                  onPlay={() => player.playTrack(track, recent)}
                  onLike={() => toggleLike.mutate({ track, liked: isLiked(track.id) })}
                  onAdd={() => player.enqueue(track)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-xl">Quick picks</h2>
          <div className="flex flex-col">
            <TrackListHeader />
            {quickPicks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                isCurrent={player.current?.id === track.id}
                isPlaying={player.isPlaying}
                liked={isLiked(track.id)}
                onPlay={() => player.playTrack(track, quickPicks)}
                onLike={() => toggleLike.mutate({ track, liked: isLiked(track.id) })}
                onAdd={() => player.enqueue(track)}
              />
            ))}
          </div>
        </section>

        {DEMO_SHELVES.map((shelf) => (
          <Shelf key={shelf.id} title={shelf.title} caption={shelf.caption}>
            {shelf.items.map((collection) => (
              <MediaCard
                key={collection.id}
                collection={collection}
                playing={player.isPlaying && player.current?.id === collection.trackIds[0]}
                onPlay={() => player.playCollection(tracksForCollection(collection.id))}
              />
            ))}
          </Shelf>
        ))}
      </div>
    </AppShell>
  );
}
