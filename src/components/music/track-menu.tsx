import { useState } from "react";
import {
  Download,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlayer } from "@/components/player/player-provider";
import {
  useAddTrackToPlaylist,
  useCreatePlaylist,
  usePlaylists,
  useToggleLike,
} from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music/types";

export function TrackMenu({
  track,
  liked,
  className,
}: {
  track: Track;
  liked?: boolean;
  className?: string;
}) {
  const player = usePlayer();
  const { user } = useSession();
  const { data: playlists } = usePlaylists(user?.id);
  const toggleLike = useToggleLike(user?.id);
  const addToPlaylist = useAddTrackToPlaylist(user?.id);
  const createPlaylist = useCreatePlaylist(user?.id);
  const [open, setOpen] = useState(false);

  const add = (playlistId: string, position: number, name: string) =>
    addToPlaylist.mutate(
      { playlistId, track, position },
      {
        onSuccess: () => toast.success(`Added to ${name}`),
        onError: (error) => toast.error((error as Error).message),
      },
    );

  const handleDownload = () => {
    const url = track.audioUrl;
    if (!url) {
      toast.error("This track streams from YouTube or Spotify and can't be downloaded.");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]/g, "");
    anchor.target = "_blank";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.success("Download started");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More options for ${track.title}`}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onSelect={() => {
            player.playNext(track);
            toast.success("Playing next");
          }}
        >
          <ListStart className="size-4" /> Play next
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            player.enqueue(track);
            toast.success("Added to queue");
          }}
        >
          <ListEnd className="size-4" /> Add to queue
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            toggleLike.mutate(
              { track, liked: Boolean(liked) },
              {
                onSuccess: () => toast.success(liked ? "Removed from liked songs" : "Saved to liked songs"),
                onError: (error) => toast.error((error as Error).message),
              },
            )
          }
        >
          <Heart className={cn("size-4", liked && "fill-current text-primary")} />
          {liked ? "Remove from liked songs" : "Like"}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ListPlus className="size-4" /> Add to playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 w-56 overflow-y-auto">
            {playlists?.length ? (
              playlists.map((playlist) => (
                <DropdownMenuItem
                  key={playlist.id}
                  onSelect={() => add(playlist.id, Date.now() % 100000, playlist.title)}
                >
                  {playlist.title}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No playlists yet</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                const name = window.prompt("New playlist name", track.album ?? "New playlist");
                if (!name?.trim()) return;
                createPlaylist.mutate(
                  { title: name.trim() },
                  {
                    onSuccess: (playlist) => add(playlist.id, 0, playlist.title),
                    onError: (error) => toast.error((error as Error).message),
                  },
                );
              }}
            >
              <Plus className="size-4" /> New playlist
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleDownload}>
          <Download className="size-4" /> Download
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
