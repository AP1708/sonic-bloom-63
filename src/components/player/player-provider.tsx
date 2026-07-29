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

  // Playback clock. Real media is driven by the official embedded players; this
  // keeps the transport UI in sync and advances the queue at track end.
  useEffect(() => {
    if (!state.isPlaying || !state.current) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev.current) return prev;
        const nextProgress = prev.progressSec + 1;
        if (nextProgress < prev.current.durationSec) {
          return { ...prev, progressSec: nextProgress };
        }
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
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.isPlaying, state.current, state.index]);

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
        setState((prev) => ({
          ...prev,
          progressSec: Math.min(Math.max(0, seconds), prev.current?.durationSec ?? 0),
        })),
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

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
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
