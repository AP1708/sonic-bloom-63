import { createFileRoute } from "@tanstack/react-router";
import { Download, Play, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Artwork } from "@/components/music/artwork";
import { EmptyState, TrackListHeader, TrackRow } from "@/components/music/track-row";
import { usePlayer } from "@/components/player/player-provider";
import {
  useLikedSongs,
  usePlaylist,
  usePlaylistTracks,
  useRemovePlaylistTrack,
  useToggleLike,
} from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";
import { formatTotalTime } from "@/lib/format";
import { downloadPlaylist } from "@/lib/music/playlist-transfer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/playlist/$playlistId")({
  head: () => ({
    meta: [
      { title: "Playlist — Sonance" },
      { name: "description", content: "A playlist in your Sonance library." },
      { property: "og:title", content: "Playlist — Sonance" },
      { property: "og:description", content: "Play, reorder, and share tracks in your Sonance playlist." },
    ],
  }),
  component: PlaylistPage,
});

function PlaylistPage() {
  const { playlistId } = Route.useParams();
  const player = usePlayer();
  const { user } = useSession();
  const { data: playlist } = usePlaylist(playlistId);
  const { data: tracks, isLoading } = usePlaylistTracks(playlistId);
  const { data: liked } = useLikedSongs(user?.id);
  const toggleLike = useToggleLike(user?.id);
  const removeTrack = useRemovePlaylistTrack();

  const total = (tracks ?? []).reduce((sum, track) => sum + track.durationSec, 0);
  const isLiked = (id: string) => Boolean(liked?.some((track) => track.id === id));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
          <Artwork
            seed={playlistId}
            src={playlist?.cover_url}
            alt=""
            className="size-40 shrink-0"
            rounded="rounded-2xl"
          />
          <div className="flex flex-col gap-2">
            <p className="label-mono">
              {playlist?.is_collaborative ? "Collaborative playlist" : "Playlist"}
            </p>
            <h1 className="text-4xl">{playlist?.title ?? "Untitled"}</h1>
            {playlist?.description && (
              <p className="max-w-xl text-sm text-muted-foreground">{playlist.description}</p>
            )}
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {playlist?.is_collaborative && <Users className="size-3.5" />}
              {tracks?.length ?? 0} tracks · {formatTotalTime(total)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!tracks?.length}
                onClick={() => tracks && player.playCollection(tracks)}
                className="flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                <Play className="size-4" /> Play
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={!tracks?.length}
                    className="flex w-fit items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    <Download className="size-4" /> Export
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onSelect={() =>
                      downloadPlaylist(playlist?.title ?? "playlist", tracks ?? [], "json", playlist?.description)
                    }
                  >
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => downloadPlaylist(playlist?.title ?? "playlist", tracks ?? [], "csv")}
                  >
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {isLoading ? (
          <p className="label-mono">Loading…</p>
        ) : tracks?.length ? (
          <div className="flex flex-col">
            <TrackListHeader />
            {tracks.map((track, index) => (
              <div key={`${track.id}-${index}`} className="group relative">
                <TrackRow
                  track={track}
                  index={index}
                  isCurrent={player.current?.id === track.id}
                  isPlaying={player.isPlaying}
                  liked={isLiked(track.id)}
                  onPlay={() => player.playTrack(track, tracks)}
                  onLike={() => toggleLike.mutate({ track, liked: isLiked(track.id) })}
                  onAdd={() => player.enqueue(track)}
                />
                <button
                  type="button"
                  onClick={() => removeTrack.mutate({ playlistId, trackId: track.id })}
                  aria-label={`Remove ${track.title} from playlist`}
                  className="absolute right-1 top-1/2 hidden -translate-y-1/2 text-muted-foreground hover:text-destructive group-hover:block"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="This playlist is empty"
            description="Find tracks in search and add them to build it out."
          />
        )}
      </div>
    </AppShell>
  );
}
