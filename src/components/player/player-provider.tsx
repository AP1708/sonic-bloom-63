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

/** Minimal surface of the official YouTube IFrame Player API that we use. */
interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (value: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

let ytApiPromise: Promise<void> | null = null;

/** Loads the IFrame Player API script once, client-side only. */
function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { YT?: { Player?: unknown }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    w.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return ytApiPromise;
}


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
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const [ytReady, setYtReady] = useState(false);

  const currentAudioUrl = state.current
    ? (state.current.audioUrl ?? audioUrlFor(state.current.id))
    : null;
  const currentVideoId = !currentAudioUrl ? (state.current?.youtubeVideoId ?? null) : null;


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

  // ---- YouTube IFrame Player API (official embedded playback) ----
  useEffect(() => {
    if (!currentVideoId) return;
    let cancelled = false;
    void loadYouTubeApi().then(() => {
      if (cancelled || ytPlayerRef.current || !ytHostRef.current) return;
      const w = window as unknown as {
        YT: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
      };
      ytPlayerRef.current = new w.YT.Player(ytHostRef.current, {
        height: "100%",
        width: "100%",
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setYtReady(true),
          onStateChange: (event: { data: number }) => {
            if (event.data === 0) handleEnded(); // ENDED
            if (event.data === 1) setState((prev) => ({ ...prev, isPlaying: true }));
            if (event.data === 2) setState((prev) => ({ ...prev, isPlaying: false }));
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentVideoId, handleEnded]);

  // Load / swap the active video.
  useEffect(() => {
    const yt = ytPlayerRef.current;
    if (!yt || !ytReady) return;
    if (!currentVideoId) {
      yt.pauseVideo();
      return;
    }
    yt.loadVideoById(currentVideoId);
  }, [currentVideoId, ytReady]);

  useEffect(() => {
    const yt = ytPlayerRef.current;
    if (!yt || !ytReady || !currentVideoId) return;
    if (state.isPlaying) yt.playVideo();
    else yt.pauseVideo();
  }, [state.isPlaying, currentVideoId, ytReady]);

  useEffect(() => {
    const yt = ytPlayerRef.current;
    if (!yt || !ytReady) return;
    yt.setVolume(Math.round((state.muted ? 0 : state.volume) * 100));
  }, [state.volume, state.muted, ytReady]);

  // Progress polling for the YouTube player.
  useEffect(() => {
    if (!currentVideoId || !ytReady || !state.isPlaying) return;
    const id = window.setInterval(() => {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      const time = yt.getCurrentTime();
      const duration = yt.getDuration();
      setState((prev) => {
        if (!prev.current) return prev;
        const current =
          duration && Math.abs(prev.current.durationSec - duration) > 1
            ? { ...prev.current, durationSec: Math.round(duration) }
            : prev.current;
        const queue =
          current === prev.current ? prev.queue : prev.queue.map((t, i) => (i === prev.index ? current : t));
        return { ...prev, current, queue, progressSec: time };
      });
    }, 500);
    return () => window.clearInterval(id);
  }, [currentVideoId, ytReady, state.isPlaying]);

  // Playback clock for sources without a stream or an embedded player (e.g. Spotify).
  useEffect(() => {
    if (!state.isPlaying || !state.current || currentAudioUrl || currentVideoId) return;
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
  }, [state.isPlaying, state.current, state.index, currentAudioUrl, currentVideoId]);

  useEffect(() => {
    if (currentAudioUrl || currentVideoId) return;
    if (!state.current) return;
    if (state.progressSec >= state.current.durationSec - 1 && state.isPlaying) {
      const id = window.setTimeout(handleEnded, 1000);
      return () => window.clearTimeout(id);
    }
  }, [state.progressSec, state.current, state.isPlaying, currentAudioUrl, currentVideoId, handleEnded]);



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
          if (prev.current?.youtubeVideoId) ytPlayerRef.current?.seekTo(clamped, true);

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
        onPause={() => !currentVideoId && setState((prev) => ({ ...prev, isPlaying: false }))}
        onError={() => !currentVideoId && setState((prev) => ({ ...prev, isPlaying: false }))}
        className="hidden"
      />
      {/* Official YouTube IFrame player — kept mounted and visible while a video track plays. */}
      <div
        className={
          currentVideoId
            ? "fixed bottom-28 right-4 z-40 w-44 overflow-hidden rounded-lg border border-border bg-black shadow-lg lg:w-56"
            : "pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0"
        }
      >
        <div className={currentVideoId ? "aspect-video w-full" : "h-0 w-0"}>
          <div ref={ytHostRef} className="size-full" />
        </div>
      </div>
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
