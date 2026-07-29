import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Artwork } from "@/components/music/artwork";
import { EmptyState } from "@/components/music/track-row";
import { useCreatePlaylist, useImportPlaylist, usePlaylists } from "@/hooks/use-library";
import { parsePlaylistFile } from "@/lib/music/playlist-transfer";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Your library — Sonance" },
      { name: "description", content: "Your playlists, saved albums, and collaborative mixes." },
      { property: "og:title", content: "Your library — Sonance" },
      { property: "og:description", content: "Manage playlists and collaborative mixes in Sonance." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { user } = useSession();
  const { data: playlists, isLoading } = usePlaylists(user?.id);
  const createPlaylist = useCreatePlaylist(user?.id);
  const [title, setTitle] = useState("");
  const [collaborative, setCollaborative] = useState(false);
  const importPlaylist = useImportPlaylist(user?.id);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (file: File) => {
    try {
      const parsed = parsePlaylistFile(file.name, await file.text());
      importPlaylist.mutate(parsed, {
        onSuccess: (playlist) =>
          toast.success(`Imported ${parsed.tracks.length} tracks into ${playlist.title}`),
        onError: (error) => toast.error((error as Error).message),
      });
    } catch (error) {
      toast.error((error as Error).message || "Could not read that playlist file.");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="label-mono">Library</p>
          <h1 className="text-3xl">Your playlists</h1>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            createPlaylist.mutate(
              { title: title.trim(), collaborative },
              { onSuccess: () => setTitle("") },
            );
          }}
          className="surface-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="New playlist name"
            aria-label="Playlist name"
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={collaborative}
              onChange={(event) => setCollaborative(event.target.checked)}
              className="accent-primary"
            />
            Collaborative
          </label>
          <button
            type="submit"
            disabled={createPlaylist.isPending}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="size-4" /> Create
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importPlaylist.isPending}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium disabled:opacity-50"
          >
            <Upload className="size-4" /> {importPlaylist.isPending ? "Importing…" : "Import"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleImportFile(file);
            }}
          />
        </form>

        {createPlaylist.error && (
          <p className="text-sm text-destructive">{(createPlaylist.error as Error).message}</p>
        )}

        {isLoading ? (
          <p className="label-mono">Loading…</p>
        ) : playlists?.length ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {playlists.map((playlist) => (
              <Link
                key={playlist.id}
                to="/playlist/$playlistId"
                params={{ playlistId: playlist.id }}
                className="lift-on-hover flex flex-col gap-3"
              >
                <Artwork
                  seed={playlist.id}
                  src={playlist.cover_url}
                  alt={`${playlist.title} cover`}
                  className="aspect-square w-full"
                />
                <div>
                  <p className="truncate text-sm font-medium">{playlist.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {playlist.is_collaborative && <Users className="size-3" />}
                    {playlist.is_public ? "Public" : "Private"} playlist
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No playlists yet"
            description="Create your first playlist above, then add tracks from search or the home shelves."
          />
        )}
      </div>
    </AppShell>
  );
}
