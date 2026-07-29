import { createFileRoute } from "@tanstack/react-router";
import { Play, Heart } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TrackListHeader, TrackRow } from "@/components/music/track-row";
import { usePlayer } from "@/components/player/player-provider";
import { useLikedSongs, useToggleLike } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";
import { formatTotalTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/liked")({
  head: () => ({
    meta: [
      { title: "Liked songs — Sonance" },
      { name: "description", content: "Every track you've saved across Spotify and YouTube." },
      { property: "og:title", content: "Liked songs — Sonance" },
      { property: "og:description", content: "Your saved tracks from both platforms in one list." },
    ],
  }),
  component: LikedPage,
});

function LikedPage() {
  const player = usePlayer();
  const { user } = useSession();
  const { data: tracks, isLoading } = useLikedSongs(user?.id);
  const toggleLike = useToggleLike(user?.id);

  const total = (tracks ?? []).reduce((sum, track) => sum + track.durationSec, 0);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex items-end gap-6">
          <div className="ember-glow grid size-40 place-items-center rounded-2xl bg-primary/15">
            <Heart className="size-14 fill-primary text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="label-mono">Playlist</p>
            <h1 className="text-4xl">Liked songs</h1>
            <p className="text-sm text-muted-foreground">
              {tracks?.length ?? 0} tracks · {formatTotalTime(total)}
            </p>
            <button
              type="button"
              disabled={!tracks?.length}
              onClick={() => tracks && player.playCollection(tracks)}
              className="mt-2 flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              <Play className="size-4" /> Play
            </button>
          </div>
        </header>

        {isLoading ? (
          <p className="label-mono">Loading…</p>
        ) : tracks?.length ? (
          <div className="flex flex-col">
            <TrackListHeader />
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                isCurrent={player.current?.id === track.id}
                isPlaying={player.isPlaying}
                liked
                onPlay={() => player.playTrack(track, tracks)}
                onLike={() => toggleLike.mutate({ track, liked: true })}
                onAdd={() => player.enqueue(track)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No liked songs yet"
            description="Tap the heart on any track to keep it here across devices."
          />
        )}
      </div>
    </AppShell>
  );
}
