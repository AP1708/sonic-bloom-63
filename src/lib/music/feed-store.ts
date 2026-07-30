/**
 * Discovery feed accumulator.
 *
 * Each time the app is opened the discovery server function returns a new
 * batch. Rather than replacing what is on screen, batches are merged into a
 * session-lived store: newly seen songs are prepended to their rail and older
 * ones stay behind them, so the feed grows over the day instead of resetting.
 */

import { useEffect, useRef, useState } from "react";
import type { DiscoveryFeed, DiscoveryRail } from "./discovery.functions";
import type { Track } from "./types";

/** Per-rail cap so a long session can't grow the feed without bound. */
const MAX_PER_RAIL = 40;
const MAX_ARTISTS = 24;
const MAX_FRESH = 24;

export interface AccumulatedFeed {
  rails: DiscoveryRail[];
  artists: DiscoveryFeed["artists"];
  /** Songs that appeared for the first time in the most recent batch. */
  fresh: Track[];
  /** How many batches have been merged so far this session. */
  batches: number;
  /** Track keys added by the latest batch (empty for the very first batch). */
  freshKeys: Set<string>;
  /** Artist names (lowercased) added by the latest batch. */
  freshArtistKeys: Set<string>;
  /** Increments with every merged batch — used to reset marker timers. */
  batchId: number;
}

export function trackKey(track: Track): string {
  return `${track.title.toLowerCase().trim()}|${track.artist.toLowerCase().trim()}`;
}

interface Store {
  rails: Map<string, DiscoveryRail>;
  artists: DiscoveryFeed["artists"];
  seen: Set<string>;
  artistSeen: Set<string>;
  fresh: Track[];
  batches: number;
  freshKeys: Set<string>;
  freshArtistKeys: Set<string>;
}

function emptyStore(): Store {
  return {
    rails: new Map(),
    artists: [],
    seen: new Set(),
    artistSeen: new Set(),
    fresh: [],
    batches: 0,
    freshKeys: new Set(),
    freshArtistKeys: new Set(),
  };
}

// Module-level so navigating away from home and back keeps the accumulated feed.
let store = emptyStore();
const merged = new WeakSet<object>();

function snapshot(): AccumulatedFeed {
  return {
    rails: [...store.rails.values()],
    artists: store.artists,
    fresh: store.fresh,
    batches: store.batches,
    freshKeys: store.freshKeys,
    freshArtistKeys: store.freshArtistKeys,
    batchId: store.batches,
  };
}

/** Drop everything (used when the mood filter changes the feed's meaning). */
export function resetDiscoveryStore() {
  store = emptyStore();
}

function mergeBatch(feed: DiscoveryFeed) {
  const freshThisBatch: Track[] = [];

  for (const rail of feed.rails) {
    const incomingNew: Track[] = [];
    const incomingKnown: Track[] = [];
    for (const track of rail.tracks) {
      const key = trackKey(track);
      if (store.seen.has(key)) {
        incomingKnown.push(track);
      } else {
        store.seen.add(key);
        incomingNew.push(track);
        freshThisBatch.push(track);
      }
    }

    const existing = store.rails.get(rail.id);
    const previous = existing?.tracks ?? [];
    // New songs lead the rail; everything already shown trails behind it.
    const combined = [...incomingNew, ...previous, ...incomingKnown];
    const deduped: Track[] = [];
    const railSeen = new Set<string>();
    for (const track of combined) {
      const key = trackKey(track);
      if (railSeen.has(key)) continue;
      railSeen.add(key);
      deduped.push(track);
      if (deduped.length >= MAX_PER_RAIL) break;
    }

    store.rails.set(rail.id, {
      id: rail.id,
      caption: rail.caption,
      title: rail.title,
      tracks: deduped,
    });
  }

  const freshArtists = new Set<string>();
  for (const artist of feed.artists) {
    const key = artist.name.toLowerCase().trim();
    if (store.artistSeen.has(key)) continue;
    store.artistSeen.add(key);
    freshArtists.add(key);
    store.artists = [...store.artists, artist].slice(0, MAX_ARTISTS);
  }

  store.fresh = freshThisBatch.slice(0, MAX_FRESH);
  store.batches += 1;
  // The very first batch is entirely new — marking all of it would be noise.
  const firstBatch = store.batches === 1;
  store.freshKeys = firstBatch ? new Set() : new Set(freshThisBatch.map(trackKey));
  store.freshArtistKeys = firstBatch ? new Set() : freshArtists;
}

/**
 * Merge each new discovery batch into the session store and return the
 * accumulated view. The same batch object is never merged twice.
 */
export function useAccumulatedDiscovery(feed: DiscoveryFeed | undefined): AccumulatedFeed {
  const [view, setView] = useState<AccumulatedFeed>(() => snapshot());
  const lastRef = useRef<DiscoveryFeed | undefined>(undefined);

  useEffect(() => {
    if (!feed || feed === lastRef.current) return;
    lastRef.current = feed;
    if (merged.has(feed)) {
      setView(snapshot());
      return;
    }
    merged.add(feed);
    mergeBatch(feed);
    setView(snapshot());
  }, [feed]);

  return view;
}

/** How long a "New" marker stays on screen after a batch merges. */
const MARKER_MS = 12_000;

/**
 * Keeps the newest batch's markers alive for a few seconds so a refresh is
 * legible, then clears them (or immediately when a newer batch arrives).
 */
export function useFreshMarkers(feed: AccumulatedFeed): {
  tracks: Set<string>;
  artists: Set<string>;
} {
  const [markers, setMarkers] = useState<{ tracks: Set<string>; artists: Set<string> }>({
    tracks: new Set(),
    artists: new Set(),
  });

  useEffect(() => {
    if (feed.freshKeys.size === 0 && feed.freshArtistKeys.size === 0) {
      setMarkers({ tracks: new Set(), artists: new Set() });
      return;
    }
    setMarkers({ tracks: feed.freshKeys, artists: feed.freshArtistKeys });
    const timer = window.setTimeout(
      () => setMarkers({ tracks: new Set(), artists: new Set() }),
      MARKER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [feed.batchId, feed.freshKeys, feed.freshArtistKeys]);

  return markers;
}
