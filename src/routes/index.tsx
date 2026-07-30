import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Shuffle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Carousel, SectionHeader } from "@/components/music/carousel";
import { ChipRow, MOODS } from "@/components/music/chip-row";
import { SongCard, MixCard } from "@/components/music/song-card";
import { ArtistCard } from "@/components/music/artist-card";
import { QuickPicksGrid } from "@/components/music/quick-picks-grid";
import { Artwork } from "@/components/music/artwork";
import { usePlayer } from "@/components/player/player-provider";
import { DEMO_COLLECTIONS, DEMO_TRACKS, tracksForCollection } from "@/lib/music/catalog";
import { artistSlug, loadFullCatalog } from "@/lib/music/full-catalog";
import { topArtists } from "@/lib/music/taste";
import { useLikedSongs, useRecentlyPlayed } from "@/hooks/use-library";
import { useListeningHistory } from "@/hooks/use-listening-history";
import { useSession } from "@/hooks/use-session";
import { greeting } from "@/lib/format";
import type { Track } from "@/lib/music/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sonance — Stream music from Spotify and YouTube Music" },
      {
        name: "description",
        content:
          "Sonance unifies your Spotify and YouTube Music in one dark, fast player with playlists, liked songs, and a synced queue.",
      },
      { property: "og:title", content: "Sonance — One player for Spotify and YouTube Music" },
      {
        property: "og:description",
        content: "Search, queue, and organise music from Spotify and YouTube Music in a single library.",
      },
      { property: "og:type", content: "music.radio_station" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function matchesMood(track: Track, keywords: string[]) {
  if (keywords.length === 0) return true;
  const haystack = `${track.title} ${track.album ?? ""} ${track.artist}`.toLowerCase();
  return keywords.some((word) => haystack.includes(word));
}

/** Deterministic spread so rails don't all start with the same recordings. */
function sample<T>(items: T[], count: number, offset = 0): T[] {
  if (items.length <= count) return items;
  const step = Math.max(1, Math.floor(items.length / count));
  const out: T[] = [];
  for (let i = 0; out.length < count && i < items.length; i += step) {
    out.push(items[(i + offset) % items.length]);
  }
  return out;
}

function HomePage() {
  const player = usePlayer();
  const { user } = useSession();
  const { data: liked } = useLikedSongs(user?.id);
  const { data: recent } = useRecentlyPlayed(user?.id);
  const { data: history } = useListeningHistory(user?.id);
  const { data: catalog } = useQuery({
    queryKey: ["full-catalog"],
    queryFn: loadFullCatalog,
    staleTime: Infinity,
  });

  const [mood, setMood] = useState("all");
  const keywords = MOODS.find((m) => m.id === mood)?.keywords ?? [];

  const pool = useMemo<Track[]>(() => {
    const base = catalog?.tracks?.length ? catalog.tracks : DEMO_TRACKS;
    const filtered = base.filter((track) => matchesMood(track, keywords));
    return filtered.length >= 12 ? filtered : base;
  }, [catalog, keywords]);

  const isLiked = (id: string) => Boolean(liked?.some((track) => track.id === id));

  const quickPicks = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const track of [...(liked ?? []), ...sample(pool, 40, 3)]) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      out.push(track);
      if (out.length >= 20) break;
    }
    return out;
  }, [liked, pool]);

  const heroTrack = quickPicks[0];
  const trending = useMemo(() => sample(pool, 18, 97), [pool]);
  const listenAgain = useMemo(() => (recent ?? []).slice(0, 12), [recent]);

  const artists = useMemo(() => {
    const affinity = topArtists(history ?? [], 8).map((entry) => ({
      id: artistSlug(entry.artist),
      name: entry.artist,
      caption: `${entry.plays} play${entry.plays === 1 ? "" : "s"}`,
    }));
    const seen = new Set(affinity.map((a) => a.id));
    const fromCatalog = (catalog?.artists ?? [])
      .filter((artist) => !seen.has(artist.id))
      .slice(0, 16)
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        caption: `${artist.trackCount} songs`,
      }));
    return [...affinity, ...fromCatalog].slice(0, 18);
  }, [history, catalog]);

  const mixes = useMemo(() => {
    const affinity = topArtists(history ?? [], 4);
    const seeds = affinity.length
      ? affinity.map((entry) => entry.artist)
      : (catalog?.artists ?? []).slice(0, 6).map((artist) => artist.name);
    return seeds.slice(0, 6).map((name) => {
      const bucket = catalog?.byArtist.get(artistSlug(name)) ?? [];
      const tracks = bucket.length ? sample(bucket, 30, 5) : sample(pool, 30, 11);
      return { id: `mix-${artistSlug(name)}`, title: `${name} radio`, subtitle: "Mix · Sonance", tracks };
    });
  }, [history, catalog, pool]);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <ChipRow active={mood} onSelect={setMood} />

        {heroTrack && (
          <section className="rise-in grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="surface-panel flex flex-col justify-between gap-6 p-6">
              <div className="flex flex-col gap-2">
                <p className="label-mono">{greeting()}</p>
                <h1 className="text-3xl leading-tight sm:text-4xl">Start radio from a song you love</h1>
                <p className="max-w-lg text-sm text-muted-foreground">
                  Public-domain Indian classics streaming in full, plus Spotify and YouTube Music resolved
                  into one queue.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => player.playCollection(quickPicks)}
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Play className="size-4" /> Play
                </button>
                <button
                  type="button"
                  onClick={() =>
                    player.playCollection([...quickPicks].sort(() => Math.random() - 0.5))
                  }
                  className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Shuffle className="size-4" /> Shuffle
                </button>
                <Link
                  to="/search"
                  className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Search
                </Link>
              </div>
            </div>

            <button
              type="button"
              onClick={() => player.playTrack(heroTrack, quickPicks)}
              className="group relative hidden overflow-hidden rounded-xl text-left lg:block"
              aria-label={`Play ${heroTrack.title}`}
            >
              <Artwork
                seed={heroTrack.id}
                src={heroTrack.artworkUrl}
                alt={`${heroTrack.title} artwork`}
                className="aspect-square w-full"
              />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-background/80 p-4 backdrop-blur">
                <span className="label-mono">Top pick</span>
                <span className="truncate text-sm font-medium">{heroTrack.title}</span>
                <span className="truncate text-xs text-muted-foreground">{heroTrack.artist}</span>
              </span>
            </button>
          </section>
        )}

        {listenAgain.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeader caption="Pick up where you left off" title="Listen again" />
            <Carousel>
              {listenAgain.map((track) => (
                <SongCard
                  key={track.id}
                  track={track}
                  playing={player.isPlaying && player.current?.id === track.id}
                  onPlay={() => player.playTrack(track, listenAgain)}
                />
              ))}
            </Carousel>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeader caption="Start radio from a song" title="Quick picks" />
          <QuickPicksGrid
            tracks={quickPicks}
            currentId={player.current?.id}
            isPlaying={player.isPlaying}
            likedIds={isLiked}
            onPlay={(track) => player.playTrack(track, quickPicks)}
          />
        </section>

        {mixes.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeader caption="Built from your listening" title="Mixed for you" />
            <Carousel>
              {mixes.map((mix) => (
                <MixCard
                  key={mix.id}
                  id={mix.id}
                  title={mix.title}
                  subtitle={mix.subtitle}
                  playing={player.isPlaying && mix.tracks.some((t) => t.id === player.current?.id)}
                  onPlay={() => player.playCollection(mix.tracks)}
                />
              ))}
            </Carousel>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeader caption="From the archive" title="Trending Indian songs" moreTo="/search" />
          <Carousel>
            {trending.map((track) => (
              <SongCard
                key={track.id}
                track={track}
                playing={player.isPlaying && player.current?.id === track.id}
                onPlay={() => player.playTrack(track, trending)}
              />
            ))}
          </Carousel>
        </section>

        {artists.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeader caption="Voices you keep returning to" title="Artists for you" moreTo="/artists" />
            <Carousel>
              {artists.map((artist) => (
                <ArtistCard key={artist.id} id={artist.id} name={artist.name} caption={artist.caption} />
              ))}
            </Carousel>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeader caption="Albums and playlists" title="Recommended for today" />
          <Carousel>
            {DEMO_COLLECTIONS.map((collection) => {
              const tracks = tracksForCollection(collection.id);
              return (
                <SongCard
                  key={collection.id}
                  track={{
                    id: collection.id,
                    title: collection.title,
                    artist: collection.subtitle,
                    album: undefined,
                    durationSec: 0,
                    source: collection.source,
                    artworkUrl: collection.artworkUrl ?? null,
                    audioUrl: null,
                    externalUrl: null,
                  }}
                  subtitle={collection.subtitle}
                  playing={player.isPlaying && tracks.some((t) => t.id === player.current?.id)}
                  onPlay={() => player.playCollection(tracks)}
                />
              );
            })}
          </Carousel>
        </section>
      </div>
    </AppShell>
  );
}
