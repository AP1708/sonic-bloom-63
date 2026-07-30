import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Play, RefreshCw, Shuffle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Carousel, SectionHeader } from "@/components/music/carousel";
import { ChipRow, MOODS } from "@/components/music/chip-row";
import { SongCard, MixCard } from "@/components/music/song-card";
import { ArtistCard } from "@/components/music/artist-card";
import { QuickPicksGrid } from "@/components/music/quick-picks-grid";
import { Artwork } from "@/components/music/artwork";
import { usePlayer } from "@/components/player/player-provider";
import { DEMO_COLLECTIONS, DEMO_TRACKS, tracksForCollection } from "@/lib/music/catalog";
import { artistSlug, artistTracks, loadFullCatalog } from "@/lib/music/full-catalog";
import { getDiscoveryFeed } from "@/lib/music/discovery.functions";
import { rotateFeedSeed, seededSample, seededShuffle, useFeedSeed } from "@/lib/music/feed-seed";
import {
  resetDiscoveryStore,
  trackKey,
  useAccumulatedDiscovery,
  useFreshMarkers,
} from "@/lib/music/feed-store";
import { topArtists } from "@/lib/music/taste";
import { useLikedSongs, useRecentlyPlayed } from "@/hooks/use-library";
import { useListeningHistory } from "@/hooks/use-listening-history";
import { useSession } from "@/hooks/use-session";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
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

  /** Rotates on every app open (and after a long time away). */
  const seed = useFeedSeed();
  /** Seeded pick helper — `salt` keeps each rail distinct within a session. */
  const sample = useMemo(
    () =>
      <T,>(items: T[], count: number, salt = 0): T[] =>
        seededSample(items, count, seed + salt * 7919),
    [seed],
  );

  const affinityArtists = useMemo(
    () => topArtists(history ?? [], 4).map((entry) => entry.artist),
    [history],
  );

  // A different mood is a different feed, so accumulated rails start over.
  useEffect(() => {
    resetDiscoveryStore();
  }, [mood]);

  /** Live suggestions from the YouTube Music catalog — new songs and artists. */
  const {
    data: discoveryBatch,
    isLoading: discoveryLoading,
    isFetching: discoveryFetching,
    refetch: refetchDiscovery,
  } = useQuery({
    queryKey: ["discovery-feed", seed, mood, affinityArtists.join("|")],
    queryFn: () =>
      getDiscoveryFeed({
        data: {
          seed,
          seedArtists: affinityArtists,
          mood: MOODS.find((m) => m.id === mood)?.label.toLowerCase() ?? "",
        },
      }),
    // The seed already gates how often new results appear; within a seed the
    // response is stable, but focus/mount refetches let a rotation land fast.
    staleTime: 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  /** Batches merge into a growing feed instead of replacing it. */
  const discovery = useAccumulatedDiscovery(discoveryBatch);
  /** Short-lived markers on whatever the latest refresh appended. */
  const freshMarkers = useFreshMarkers(discovery);

  const refreshFeed = () => {
    rotateFeedSeed();
    void refetchDiscovery();
  };


  const pool = useMemo<Track[]>(() => {
    const base = catalog?.tracks?.length ? catalog.tracks : DEMO_TRACKS;
    const filtered = base.filter((track) => matchesMood(track, keywords));
    return filtered.length >= 12 ? filtered : base;
  }, [catalog, keywords]);

  const isLiked = (id: string) => Boolean(liked?.some((track) => track.id === id));

  const discoveryTracks = useMemo(
    () => (discovery?.rails ?? []).flatMap((rail) => rail.tracks),
    [discovery],
  );

  const quickPicks = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    // Blend fresh discovery picks with liked songs and the archive so every
    // open surfaces something new at the top of the feed.
    const mixed = seededShuffle(
      [...sample(discoveryTracks, 10, 2), ...(liked ?? []).slice(0, 6), ...sample(pool, 30, 3)],
      seed + 17,
    );
    for (const track of mixed) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      out.push(track);
      if (out.length >= 20) break;
    }
    return out;
  }, [liked, pool, discoveryTracks, sample, seed]);

  const heroTrack = quickPicks[0];
  const trending = useMemo(() => sample(pool, 18, 11), [pool, sample]);
  const listenAgain = useMemo(() => (recent ?? []).slice(0, 12), [recent]);

  const artists = useMemo(() => {
    const affinity = topArtists(history ?? [], 8).map((entry) => ({
      id: artistSlug(entry.artist),
      name: entry.artist,
      caption: `${entry.plays} play${entry.plays === 1 ? "" : "s"}`,
    }));
    const seen = new Set(affinity.map((a) => a.id));
    const fromCatalog = sample(
      (catalog?.artists ?? []).filter((artist) => !seen.has(artist.id)),
      16,
      5,
    ).map((artist) => ({
      id: artist.id,
      name: artist.name,
      caption: `${artist.trackCount} songs`,
    }));
    return [...affinity, ...fromCatalog].slice(0, 18);
  }, [history, catalog, sample]);

  /** Artists from discovery the listener has no history with. */
  const newArtists = useMemo(() => {
    const known = new Set(
      [
        ...(history ?? []).map((entry) => entry.track?.artist?.toLowerCase()),
        ...(catalog?.artists ?? []).map((artist) => artist.name.toLowerCase()),
      ].filter(Boolean) as string[],
    );
    return (discovery?.artists ?? []).filter((artist) => !known.has(artist.name.toLowerCase()));
  }, [discovery, history, catalog]);

  const mixes = useMemo(() => {
    const affinity = topArtists(history ?? [], 4);
    const seeds = affinity.length
      ? affinity.map((entry) => entry.artist)
      : sample(catalog?.artists ?? [], 6, 13).map((artist) => artist.name);
    return seeds.slice(0, 6).map((name) => {
      const bucket = artistTracks(catalog, artistSlug(name));
      const tracks = bucket.length ? sample(bucket, 30, 19) : sample(pool, 30, 23);
      return { id: `mix-${artistSlug(name)}`, title: `${name} radio`, subtitle: "Mix · Sonance", tracks };
    });
  }, [history, catalog, pool, sample]);

  /** Endless rails, revealed as the user scrolls: discovery first, then archive. */
  const extraSections = useMemo(() => {
    const sections: { id: string; caption: string; title: string; tracks: Track[] }[] = [];

    // Songs that arrived with the latest open get their own rail up front.
    if (discovery.batches > 1 && discovery.fresh.length >= 4) {
      sections.push({
        id: `fresh-batch-${discovery.batches}`,
        caption: "Added since you were last here",
        title: "Fresh for you",
        tracks: discovery.fresh,
      });
    }

    // Extra discovery rails beyond the four shown up top.
    discovery.rails.slice(4).forEach((rail) => {
      sections.push({ id: rail.id, caption: rail.caption, title: rail.title, tracks: rail.tracks });
    });


    // Discovery artists become their own rails so scrolling keeps introducing
    // unfamiliar names, not just archive deep cuts.
    newArtists.slice(0, 8).forEach((artist, index) => {
      const tracks = discoveryTracks.filter((track) => track.artist === artist.name);
      if (tracks.length < 4) return;
      sections.push({
        id: `new-artist-${artistSlug(artist.name)}-${index}`,
        caption: "New to you",
        title: artist.name,
        tracks,
      });
    });

    const used = new Set(artists.slice(0, 8).map((artist) => artist.id));
    const catalogArtists = sample(
      (catalog?.artists ?? []).filter((artist) => !used.has(artist.id)),
      40,
      29,
    );

    catalogArtists.forEach((artist, index) => {
      const bucket = artistTracks(catalog, artist.id);
      const tracks = bucket.length >= 4 ? sample(bucket, 16, 31 + index) : [];
      if (tracks.length < 4) return;
      sections.push({
        id: `artist-rail-${artist.id}`,
        caption: index % 2 === 0 ? "More from the archive" : "Because you explore Indian classics",
        title: artist.name,
        tracks,
      });
    });

    for (let i = 0; sections.length < 30 && i < 24; i += 1) {
      const tracks = sample(pool, 16, 101 + i);
      if (tracks.length < 4) break;
      sections.push({
        id: `deep-cuts-${i}`,
        caption: "Keep listening",
        title: `Deep cuts, vol. ${i + 1}`,
        tracks,
      });
    }
    return sections;
  }, [artists, catalog, pool, discovery, discoveryTracks, newArtists, sample]);

  const SECTIONS_PER_PAGE = 2;
  const { pages, hasMore, loading, sentinelRef } = useInfiniteScroll({
    totalPages: Math.ceil(extraSections.length / SECTIONS_PER_PAGE),
    initialPages: 1,
  });
  const visibleExtras = extraSections.slice(0, pages * SECTIONS_PER_PAGE);
  const topRails = discovery.rails.slice(0, 4);


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

        {/* Fresh suggestions pulled live from YouTube Music on every open. */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {discoveryFetching
              ? "Refreshing your picks…"
              : discovery.batches > 1 && discovery.fresh.length > 0
                ? `${discovery.fresh.length} new song${discovery.fresh.length === 1 ? "" : "s"} added to your feed`
                : "Recommendations refresh each time you open the app"}
          </p>
          <button
            type="button"
            onClick={refreshFeed}
            disabled={discoveryFetching}
            className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${discoveryFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {discoveryLoading && topRails.length === 0 && (
          <section className="flex flex-col gap-4" aria-busy>
            <SectionHeader caption="Fetching today's picks" title="New releases" />
            <div className="scroll-rail flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 w-36 shrink-0 animate-pulse rounded-xl bg-muted/40 sm:w-40"
                />
              ))}
            </div>
          </section>
        )}


        {topRails.map((rail) => (
          <section key={rail.id} className="flex flex-col gap-4">
            <SectionHeader caption={rail.caption} title={rail.title} moreTo="/search" />
            <Carousel>
              {rail.tracks.map((track) => (
                <SongCard
                  key={`${rail.id}-${track.id}`}
                  track={track}
                  playing={player.isPlaying && player.current?.id === track.id}
                  onPlay={() => player.playTrack(track, rail.tracks)}
                />
              ))}
            </Carousel>
          </section>
        ))}

        {newArtists.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeader caption="Artists you haven't heard yet" title="New artists for you" />
            <Carousel>
              {newArtists.map((artist) => (
                <ArtistCard
                  key={artist.name}
                  id={artistSlug(artist.name)}
                  name={artist.name}
                  caption="Start radio"
                  imageUrl={artist.artworkUrl}
                  onPlay={() =>
                    player.playTrack(
                      artist.sample,
                      discoveryTracks.filter((track) => track.artist === artist.name),
                    )
                  }
                />
              ))}
            </Carousel>
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

        {visibleExtras.map((section) => (
          <section key={section.id} className="flex flex-col gap-4">
            <SectionHeader caption={section.caption} title={section.title} />
            <Carousel>
              {section.tracks.map((track) => (
                <SongCard
                  key={`${section.id}-${track.id}`}
                  track={track}
                  playing={player.isPlaying && player.current?.id === track.id}
                  onPlay={() => player.playTrack(track, section.tracks)}
                />
              ))}
            </Carousel>
          </section>
        ))}

        <div ref={sentinelRef} aria-hidden className="h-px" />

        {hasMore ? (
          <p className="pb-6 text-center text-xs text-muted-foreground" role="status">
            {loading ? "Loading more music…" : "Scroll for more"}
          </p>
        ) : (
          visibleExtras.length > 0 && (
            <p className="pb-6 text-center text-xs text-muted-foreground">You've reached the end</p>
          )
        )}
      </div>
    </AppShell>
  );
}
