import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Track } from "@/lib/music/types";
import { audioUrlFor } from "@/lib/music/catalog";
import { recordPlay } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";

export type SidePanel = "queue" | "lyrics" | null;
export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  progressSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  panel: SidePanel;
  fullscreen: boolean;
}

interface PlayerActions {
  playTrack: (track: Track, contextQueue?: Track[]) => void;
  playCollection: (tracks: Track[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setPanel: (panel: SidePanel) => void;
  setFullscreen: (value: boolean) => void;
  enqueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

const PlayerContext = createContext<(PlayerState & PlayerActions) | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: 0,
    current: null,
    isPlaying: false,
    progressSec: 0,
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: "off",
    panel: null,
    fullscreen: false,
  });

  const loggedRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentAudioUrl = state.current
    ? (state.current.audioUrl ?? audioUrlFor(state.current.id))
    : null;

  /** Advance the queue when a track finishes (shared by the audio element and the clock). */
  const handleEnded = useCallback(() => {
    setState((prev) => {
      if (!prev.current) return prev;
      if (prev.repeat === "one") return { ...prev, progressSec: 0 };
      const isLast = prev.index >= prev.queue.length - 1;
      if (isLast && prev.repeat !== "all") {
        return { ...prev, isPlaying: false, progressSec: prev.current.durationSec };
      }
      const nextIndex = isLast ? 0 : prev.index + 1;
      return {
        ...prev,
        index: nextIndex,
        current: prev.queue[nextIndex] ?? prev.current,
        progressSec: 0,
      };
    });
  }, []);

  // Real audio playback for tracks with a direct stream (public-domain archive).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentAudioUrl) {
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    if (audio.src !== currentAudioUrl) {
      audio.src = currentAudioUrl;
      audio.load();
    }
  }, [currentAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentAudioUrl) return;
    if (state.isPlaying) void audio.play().catch(() => {});
    else audio.pause();
  }, [state.isPlaying, currentAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.muted ? 0 : state.volume;
  }, [state.volume, state.muted]);

  // Playback clock for embedded-player sources (Spotify/YouTube) without a stream.
  useEffect(() => {
    if (!state.isPlaying || !state.current || currentAudioUrl) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev.current) return prev;
        const nextProgress = prev.progressSec + 1;
        if (nextProgress < prev.current.durationSec) {
          return { ...prev, progressSec: nextProgress };
        }
        return prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.isPlaying, state.current, state.index, currentAudioUrl]);

  useEffect(() => {
    if (currentAudioUrl) return;
    if (!state.current) return;
    if (state.progressSec >= state.current.durationSec - 1 && state.isPlaying) {
      const id = window.setTimeout(handleEnded, 1000);
      return () => window.clearTimeout(id);
    }
  }, [state.progressSec, state.current, state.isPlaying, currentAudioUrl, handleEnded]);


  // Recently played history (app data only).
  useEffect(() => {
    if (!user || !state.current) return;
    const key = `${state.current.id}:${state.index}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    void recordPlay(user.id, state.current).catch(() => {});
  }, [user, state.current, state.index]);

  const actions = useMemo<PlayerActions>(
    () => ({
      playTrack: (track, contextQueue) => {
        const queue = contextQueue?.length ? contextQueue : [track];
        const index = Math.max(
          0,
          queue.findIndex((item) => item.id === track.id),
        );
        setState((prev) => ({ ...prev, queue, index, current: queue[index], progressSec: 0, isPlaying: true }));
      },
      playCollection: (tracks, startIndex = 0) => {
        if (!tracks.length) return;
        setState((prev) => ({
          ...prev,
          queue: tracks,
          index: startIndex,
          current: tracks[startIndex],
          progressSec: 0,
          isPlaying: true,
        }));
      },
      toggle: () => setState((prev) => (prev.current ? { ...prev, isPlaying: !prev.isPlaying } : prev)),
      next: () =>
        setState((prev) => {
          if (!prev.queue.length) return prev;
          const nextIndex = prev.shuffle
            ? Math.floor(Math.random() * prev.queue.length)
            : (prev.index + 1) % prev.queue.length;
          return { ...prev, index: nextIndex, current: prev.queue[nextIndex], progressSec: 0 };
        }),
      previous: () =>
        setState((prev) => {
          if (!prev.queue.length) return prev;
          if (prev.progressSec > 4) return { ...prev, progressSec: 0 };
          const prevIndex = (prev.index - 1 + prev.queue.length) % prev.queue.length;
          return { ...prev, index: prevIndex, current: prev.queue[prevIndex], progressSec: 0 };
        }),
      seek: (seconds) =>
        setState((prev) => {
          const clamped = Math.min(Math.max(0, seconds), prev.current?.durationSec ?? 0);
          if (audioRef.current && audioRef.current.src) audioRef.current.currentTime = clamped;
          return { ...prev, progressSec: clamped };
        }),
      setVolume: (value) => setState((prev) => ({ ...prev, volume: value, muted: value === 0 })),
      toggleMute: () => setState((prev) => ({ ...prev, muted: !prev.muted })),
      toggleShuffle: () => setState((prev) => ({ ...prev, shuffle: !prev.shuffle })),
      cycleRepeat: () =>
        setState((prev) => ({
          ...prev,
          repeat: prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
        })),
      setPanel: (panel) => setState((prev) => ({ ...prev, panel: prev.panel === panel ? null : panel })),
      setFullscreen: (value) => setState((prev) => ({ ...prev, fullscreen: value })),
      enqueue: (track) => setState((prev) => ({ ...prev, queue: [...prev.queue, track] })),
      removeFromQueue: (index) =>
        setState((prev) => {
          const queue = prev.queue.filter((_, i) => i !== index);
          const newIndex = index < prev.index ? prev.index - 1 : prev.index;
          return { ...prev, queue, index: Math.max(0, Math.min(newIndex, queue.length - 1)) };
        }),
      clearQueue: () =>
        setState((prev) => ({
          ...prev,
          queue: prev.current ? [prev.current] : [],
          index: 0,
        })),
    }),
    [],
  );

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return (
    <PlayerContext.Provider value={value}>
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          setState((prev) => (prev.current ? { ...prev, progressSec: time } : prev));
        }}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (!Number.isFinite(duration)) return;
          setState((prev) => {
            if (!prev.current || Math.abs(prev.current.durationSec - duration) < 1) return prev;
            const current = { ...prev.current, durationSec: Math.round(duration) };
            const queue = prev.queue.map((t, i) => (i === prev.index ? current : t));
            return { ...prev, current, queue };
          });
        }}
        onEnded={handleEnded}
        onPlay={() => setState((prev) => ({ ...prev, isPlaying: true }))}
        onPause={() => setState((prev) => ({ ...prev, isPlaying: false }))}
        onError={() => setState((prev) => ({ ...prev, isPlaying: false }))}
        className="hidden"
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return context;
}

/** Convenience helper for play buttons that toggle the currently playing track. */
export function usePlayToggle(track: Track | null) {
  const player = usePlayer();
  const isCurrent = Boolean(track && player.current?.id === track.id);
  const onPlay = useCallback(
    (queue?: Track[]) => {
      if (!track) return;
      if (isCurrent) player.toggle();
      else player.playTrack(track, queue);
    },
    [track, isCurrent, player],
  );
  return { isCurrent, isPlaying: isCurrent && player.isPlaying, onPlay };
}
