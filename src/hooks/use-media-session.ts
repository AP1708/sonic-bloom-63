import { useEffect } from "react";
import type { Track } from "@/lib/music/types";

interface MediaSessionOptions {
  track: Track | null;
  isPlaying: boolean;
  progressSec: number;
  durationSec: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
}

type Handler = () => void;

function setHandler(action: string, handler: ((details?: unknown) => void) | null) {
  try {
    (navigator.mediaSession as unknown as {
      setActionHandler: (a: string, h: ((d?: unknown) => void) | null) => void;
    }).setActionHandler(action, handler);
  } catch {
    // Unsupported action on this browser — safe to ignore.
  }
}

/**
 * Publishes the current track to the OS media session so lock screens,
 * notification shades, Bluetooth remotes and browser media hubs can control
 * playback while the app is in the background or the screen is off.
 */
export function useMediaSession({
  track,
  isPlaying,
  progressSec,
  durationSec,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSeek,
}: MediaSessionOptions) {
  // Metadata (title / artist / artwork).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artwork = track.artworkUrl
      ? [
          { src: track.artworkUrl, sizes: "96x96", type: "image/jpeg" },
          { src: track.artworkUrl, sizes: "256x256", type: "image/jpeg" },
          { src: track.artworkUrl, sizes: "512x512", type: "image/jpeg" },
        ]
      : [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album ?? "Sonance",
      artwork,
    });
  }, [track]);

  // Playback state + scrubber position.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = track ? (isPlaying ? "playing" : "paused") : "none";
    if (!track || !Number.isFinite(durationSec) || durationSec <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: durationSec,
        playbackRate: 1,
        position: Math.min(Math.max(progressSec, 0), durationSec),
      });
    } catch {
      // Some browsers reject position updates mid-load.
    }
  }, [track, isPlaying, progressSec, durationSec]);

  // Action handlers.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const handlers: Array<[string, Handler | ((d?: unknown) => void)]> = [
      ["play", onPlay],
      ["pause", onPause],
      ["stop", onPause],
      ["nexttrack", onNext],
      ["previoustrack", onPrevious],
      [
        "seekbackward",
        (details?: unknown) => {
          const offset = (details as { seekOffset?: number } | undefined)?.seekOffset ?? 10;
          onSeek(Math.max(0, progressSec - offset));
        },
      ],
      [
        "seekforward",
        (details?: unknown) => {
          const offset = (details as { seekOffset?: number } | undefined)?.seekOffset ?? 10;
          onSeek(progressSec + offset);
        },
      ],
      [
        "seekto",
        (details?: unknown) => {
          const time = (details as { seekTime?: number } | undefined)?.seekTime;
          if (typeof time === "number") onSeek(time);
        },
      ],
    ];
    for (const [action, handler] of handlers) setHandler(action, handler as (d?: unknown) => void);
    return () => {
      for (const [action] of handlers) setHandler(action, null);
    };
  }, [onPlay, onPause, onNext, onPrevious, onSeek, progressSec]);
}
