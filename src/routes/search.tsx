import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search as SearchIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TrackRow, TrackListHeader, EmptyState } from "@/components/music/track-row";
import { usePlayer } from "@/components/player/player-provider";
import { searchAll } from "@/lib/music/providers";
import { useLikedSongs, useToggleLike } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import type { MusicSource } from "@/lib/music/types";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Sonance" },
      {
        name: "description",
        content: "Search tracks across Spotify and YouTube Music at once and queue them instantly.",
      },
      { property: "og:title", content: "Search across Spotify and YouTube Music — Sonance" },
      {
        property: "og:description",
        content: "One search box for both music platforms, with graceful fallbacks.",
      },
    ],
  }),
  component: SearchPage,
});

const FILTERS: { value: MusicSource | "all"; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "archive", label: "Archive" },
  { value: "spotify", label: "Spotify" },
  { value: "youtube", label: "YouTube Music" },
];

function SearchPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<MusicSource | "all">("all");
  const player = usePlayer();
  const { user } = useSession();
  const { data: liked } = useLikedSongs(user?.id);
  const toggleLike = useToggleLike(user?.id);

  const results = useQuery({
    queryKey: ["search", query, source],
    enabled: query.trim().length > 1,
    queryFn: ({ signal }) => searchAll(query.trim(), { source, signal }),
  });

  const isLiked = (id: string) => Boolean(liked?.some((track) => track.id === id));
  const tracks = results.data?.tracks ?? [];

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl">Search</h1>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Songs, artists, or albums"
              aria-label="Search music"
              className="h-12 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSource(filter.value)}
                className={cn(
                  "rounded-full border border-border px-3 py-1.5 text-xs transition-colors",
                  source === filter.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        {results.data?.degraded?.length ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 text-primary" />
            <div className="text-xs text-muted-foreground">
              {results.data.degraded.map((item) => (
                <p key={item.source}>
                  <span className="text-foreground">{item.source}</span>: {item.reason}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {query.trim().length < 2 ? (
          <EmptyState
            title="Start typing"
            description="Search runs against every connected source at once and interleaves the results."
          />
        ) : results.isLoading ? (
          <p className="label-mono">Searching…</p>
        ) : tracks.length === 0 ? (
          <EmptyState title="No matches" description={`Nothing found for “${query}”.`} />
        ) : (
          <div className="flex flex-col">
            <TrackListHeader />
            {tracks.map((track, index) => (
              <TrackRow
                key={`${track.source}-${track.id}`}
                track={track}
                index={index}
                isCurrent={player.current?.id === track.id}
                isPlaying={player.isPlaying}
                liked={isLiked(track.id)}
                onPlay={() => player.playTrack(track, tracks)}
                onLike={() => toggleLike.mutate({ track, liked: isLiked(track.id) })}
                onAdd={() => player.enqueue(track)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
