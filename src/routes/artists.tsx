import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Artwork } from "@/components/music/artwork";
import { loadFullCatalog } from "@/lib/music/full-catalog";

export const Route = createFileRoute("/artists")({
  head: () => ({
    meta: [
      { title: "Indian playback artists — Sonance" },
      {
        name: "description",
        content:
          "Browse every Indian playback singer in the Sonance archive — Lata Mangeshkar, Mohammed Rafi, Asha Bhosle, Kishore Kumar and more, with thousands of streamable recordings.",
      },
      { property: "og:title", content: "Indian playback artists — Sonance" },
      {
        property: "og:description",
        content: "Thousands of golden-era Indian recordings, organised by singer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArtistsPage,
});

function ArtistsPage() {
  const [filter, setFilter] = useState("");
  const catalog = useQuery({
    queryKey: ["full-catalog"],
    queryFn: loadFullCatalog,
    staleTime: Infinity,
  });

  const artists = useMemo(() => {
    const list = catalog.data?.artists ?? [];
    const q = filter.trim().toLowerCase();
    return q ? list.filter((artist) => artist.name.toLowerCase().includes(q)) : list;
  }, [catalog.data, filter]);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Public-domain archive
          </p>
          <h1 className="text-3xl">Indian artists</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {catalog.data
              ? `${catalog.data.tracks.length.toLocaleString()} recordings across ${catalog.data.artists.length} playback singers — every song streams in full.`
              : "Loading the full archive…"}
          </p>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter artists"
            className="h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </header>

        {catalog.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading catalog…
          </div>
        ) : null}

        {catalog.isError ? (
          <p className="text-sm text-destructive">Couldn't load the archive catalog. Try again.</p>
        ) : null}

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              to="/artists/$artistId"
              params={{ artistId: artist.id }}
              className="group flex flex-col items-center gap-3 text-center"
            >
              <div className="lift-on-hover w-full">
                <Artwork
                  seed={artist.id}
                  alt={`${artist.name} artwork`}
                  className="aspect-square w-full"
                  rounded="rounded-full"
                />
              </div>
              <div>
                <p className="truncate text-sm font-medium">{artist.name}</p>
                <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Mic2 className="size-3" />
                  {artist.trackCount.toLocaleString()} songs
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
