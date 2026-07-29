export type MusicSource = "spotify" | "youtube" | "archive";

export interface Track {
  id: string;
  source: MusicSource;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string | null;
  durationSec: number;
  /** Direct audio stream (public-domain archive recordings). Played by the built-in engine. */
  audioUrl?: string | null;
  /** YouTube video id, when the track is playable through the IFrame Player API. */
  youtubeVideoId?: string | null;
  /** Spotify track URI, played through the Web Playback SDK for Premium listeners. */
  spotifyUri?: string | null;
  /** 30s preview clip, used as a fallback when the listener has no Premium session. */
  previewUrl?: string | null;
  /** Canonical link back to the source platform (required by both platforms' terms). */
  externalUrl?: string | null;
}

export interface Collection {
  id: string;
  title: string;
  subtitle: string;
  kind: "album" | "playlist" | "mix";
  source: MusicSource;
  trackIds: string[];
  artworkUrl?: string | null;
}

export interface Shelf {
  id: string;
  title: string;
  caption?: string;
  items: Collection[];
}

export interface SearchOptions {
  source?: MusicSource | "all";
  limit?: number;
  signal?: AbortSignal;
}

export interface SearchResults {
  tracks: Track[];
  /** Sources that failed or are not configured, surfaced in the UI instead of failing the search. */
  degraded: { source: MusicSource; reason: string }[];
}

export interface LyricLine {
  timeSec: number;
  text: string;
}
