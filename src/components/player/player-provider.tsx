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
import { toast } from "sonner";
import { audioUrlFor } from "@/lib/music/catalog";
import { spotifyPlayback } from "@/lib/music/spotify-playback";
import { readSession as readSpotifySession } from "@/lib/music/spotify-auth";
import { resolveYouTubeVideoId, resolveSpotifyUri } from "@/lib/music/resolve-playback";

import {
  RESUME_END_GUARD_SEC,
  RESUME_MIN_SEC,
  clearPlaybackPosition,
  recordPlay,
  savePlaybackPosition,
  useLastPlaybackPosition,
} from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";

export type SidePanel = "queue" | "lyrics" | null;
export type RepeatMode = "off" | "all" | "one";

/** Minimal surface of the official YouTube IFrame Player API that we use. */
interface YTPlayer {
  loadVideoById: (id: string | { videoId: string; startSeconds?: number }) => void;
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

export type PlaybackStatus = "idle" | "resolving" | "buffering" | "ready" | "unavailable";

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
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  retrySource: () => void;
}

interface PlayerStatus {
  status: PlaybackStatus;
  statusLabel: string | null;
  activeSource: "spotify" | "stream" | "youtube" | "preview" | null;
}

const PlayerContext = createContext<(PlayerState & PlayerActions & PlayerStatus) | null>(null);


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
  const userRef = useRef<string | null>(null);
  userRef.current = user?.id ?? null;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const [ytReady, setYtReady] = useState(false);

  const spotifyActiveRef = useRef(false);
  const [spotifyStreaming, setSpotifyStreaming] = useState(false);
  /** YouTube video resolved on demand for tracks that have no playable stream. */
  const [resolvedVideoId, setResolvedVideoId] = useState<{ trackId: string; videoId: string | null } | null>(
    null,
  );
  /** Spotify URI resolved on demand for tracks that came from another source. */
  const [resolvedSpotify, setResolvedSpotify] = useState<{ trackId: string; uri: string | null } | null>(
    null,
  );

  /** Tracks whose direct stream failed to load — fall through to the next source. */
  const [deadAudio, setDeadAudio] = useState<string[]>([]);
  /** YouTube videos that refused to play (blocked / removed / not embeddable). */
  const [deadVideos, setDeadVideos] = useState<string[]>([]);

  const rawAudioUrl = state.current
    ? (state.current.audioUrl ?? audioUrlFor(state.current.id))
    : null;
  const directAudioUrl =
    state.current && deadAudio.includes(state.current.id) ? null : rawAudioUrl;

  const ownSpotifyUri = state.current?.spotifyUri ?? null;
  const fallbackSpotifyUri =
    state.current && resolvedSpotify?.trackId === state.current.id ? resolvedSpotify.uri : null;
  // A resolved match only takes over when there is no direct stream to play.
  const spotifyUri = ownSpotifyUri ?? (directAudioUrl ? null : fallbackSpotifyUri);
  const useSpotifySdk = Boolean(spotifyUri) && spotifyStreaming;


  const rawOwnVideoId = state.current?.youtubeVideoId ?? null;
  const ownVideoId = rawOwnVideoId && !deadVideos.includes(rawOwnVideoId) ? rawOwnVideoId : null;
  const rawFallbackVideoId =
    state.current && resolvedVideoId?.trackId === state.current.id ? resolvedVideoId.videoId : null;
  const fallbackVideoId =
    rawFallbackVideoId && !deadVideos.includes(rawFallbackVideoId) ? rawFallbackVideoId : null;

  // Priority: Spotify SDK → direct stream → YouTube video → 30s preview clip.
  const currentVideoId = useSpotifySdk || directAudioUrl ? null : (ownVideoId ?? fallbackVideoId);
  const currentAudioUrl = useSpotifySdk
    ? null
    : (directAudioUrl ?? (currentVideoId ? null : (state.current?.previewUrl ?? null)));

  const videoIdRef = useRef<string | null>(null);
  videoIdRef.current = currentVideoId;

  /** True while the active source is fetching data rather than actually playing. */
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [ytBuffering, setYtBuffering] = useState(false);

  const trackId = state.current?.id ?? null;
  const spotifyLookupDone = !state.current || Boolean(ownSpotifyUri) || resolvedSpotify?.trackId === trackId;
  const youtubeLookupDone = !state.current || Boolean(ownVideoId) || resolvedVideoId?.trackId === trackId;
  const hasSource = Boolean(useSpotifySdk || currentAudioUrl || currentVideoId);

  const activeSource: PlayerStatus["activeSource"] = useSpotifySdk
    ? "spotify"
    : directAudioUrl
      ? "stream"
      : currentVideoId
        ? "youtube"
        : currentAudioUrl
          ? "preview"
          : null;

  const status: PlaybackStatus = !state.current
    ? "idle"
    : hasSource
      ? (audioBuffering || ytBuffering) && state.isPlaying
        ? "buffering"
        : "ready"
      : youtubeLookupDone && spotifyLookupDone
        ? "unavailable"
        : "resolving";

  const statusLabel =
    status === "resolving"
      ? "Finding a playable source…"
      : status === "buffering"
        ? "Buffering…"
        : status === "unavailable"
          ? "No playable source found"
          : null;

  // Reset transient source flags whenever the track changes.
  useEffect(() => {
    setAudioBuffering(false);
    setYtBuffering(false);
  }, [trackId]);

  /** Clears failure memory for the current track and re-runs source resolution. */
  const retrySource = useCallback(() => {
    const track = state.current;
    if (!track) return;
    setDeadAudio((prev) => prev.filter((id) => id !== track.id));
    setDeadVideos([]);
    setResolvedVideoId((prev) => (prev?.trackId === track.id ? null : prev));
    setResolvedSpotify((prev) => (prev?.trackId === track.id ? null : prev));
    setAudioBuffering(false);
    setYtBuffering(false);
    setState((prev) => ({ ...prev, progressSec: 0, isPlaying: true }));
  }, [state.current]);

  const retrySourceRef = useRef(retrySource);
  retrySourceRef.current = retrySource;



  // Nothing should hang forever: if resolution or buffering stalls, drop the
  // stuck source so the next one in the chain gets a turn.
  useEffect(() => {
    if (status !== "resolving" && status !== "buffering") return;
    const timeout = window.setTimeout(() => {
      const track = state.current;
      if (!track) return;
      if (status === "buffering") {
        if (currentVideoId) {
          setDeadVideos((prev) => (prev.includes(currentVideoId) ? prev : [...prev, currentVideoId]));
        } else if (directAudioUrl) {
          setDeadAudio((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
        }
        return;
      }
      // Resolution never came back — record an empty result so the UI stops spinning.
      if (!youtubeLookupDone) setResolvedVideoId({ trackId: track.id, videoId: null });
      if (!spotifyLookupDone) setResolvedSpotify({ trackId: track.id, uri: null });
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [status, state.current, currentVideoId, directAudioUrl, youtubeLookupDone, spotifyLookupDone]);

  // Auto-advance instead of sitting silently on an unplayable track.
  useEffect(() => {
    if (status !== "unavailable" || !state.isPlaying) return;
    const track = state.current;
    const timeout = window.setTimeout(() => {
      setState((prev) => {
        if (!prev.queue.length || prev.queue.length < 2) return { ...prev, isPlaying: false };
        const nextIndex = (prev.index + 1) % prev.queue.length;
        return { ...prev, index: nextIndex, current: prev.queue[nextIndex], progressSec: 0 };
      });
      toast("Skipping unplayable track", {
        description: track ? `No stream available for “${track.title}”.` : undefined,
      });
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [status, state.isPlaying, state.current]);




  // Resolve a Spotify match for tracks from other sources, so a linked Premium
  // session can stream anything the catalog surfaces.
  useEffect(() => {
    const track = state.current;
    if (!track || ownSpotifyUri) return;
    if (!readSpotifySession()) return;
    if (resolvedSpotify?.trackId === track.id) return;

    let cancelled = false;
    void resolveSpotifyUri(track).then((uri) => {
      if (cancelled) return;
      setResolvedSpotify({ trackId: track.id, uri });
    });
    return () => {
      cancelled = true;
    };
  }, [state.current, ownSpotifyUri, resolvedSpotify]);

  // Resolve a YouTube match for every track without a direct stream, so the
  // video source stays ready even while Spotify is streaming.
  useEffect(() => {
    const track = state.current;
    if (!track || directAudioUrl || ownVideoId) return;
    if (resolvedVideoId?.trackId === track.id) return;
    let cancelled = false;
    void resolveYouTubeVideoId(track).then((videoId) => {
      if (cancelled) return;
      setResolvedVideoId({ trackId: track.id, videoId });
      if (!videoId && !track.previewUrl && !spotifyUri) {
        toast("No playable audio found", {
          description: `Couldn't find a stream for “${track.title}”.`,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.current, directAudioUrl, ownVideoId, resolvedVideoId, spotifyUri]);




  // ---- Resume where the listener left off (account-synced) ----
  const { data: lastPosition } = useLastPlaybackPosition(user?.id);
  const pendingResumeRef = useRef<{ trackId: string; positionSec: number } | null>(null);
  const restoredRef = useRef(false);
  const savedAtRef = useRef(0);

  // Restore the last track once per session, paused and pre-seeked.
  useEffect(() => {
    if (restoredRef.current || !user || !lastPosition) return;
    const { track, positionSec } = lastPosition;
    if (state.queue.length) return;
    restoredRef.current = true;
    if (
      positionSec < RESUME_MIN_SEC ||
      (track.durationSec > 0 && positionSec > track.durationSec - RESUME_END_GUARD_SEC)
    ) {
      return;
    }
    pendingResumeRef.current = { trackId: track.id, positionSec };
    setState((prev) =>
      prev.queue.length
        ? prev
        : { ...prev, queue: [track], index: 0, current: track, progressSec: positionSec, isPlaying: false },
    );
  }, [user, lastPosition, state.queue.length]);

  /** Applies (and consumes) a pending resume offset for the active track. */
  const takeResumeOffset = useCallback((trackId: string | null | undefined) => {
    const pending = pendingResumeRef.current;
    if (!pending || !trackId || pending.trackId !== trackId) return null;
    pendingResumeRef.current = null;
    return pending.positionSec;
  }, []);

  /** Advance the queue when a track finishes (shared by the audio element and the clock). */
  const handleEnded = useCallback(() => {
    setState((prev) => {
      if (!prev.current) return prev;
      if (userRef.current && prev.repeat !== "one") {
        void clearPlaybackPosition(userRef.current, prev.current.id).catch(() => {});
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
            if (event.data === 3) setYtBuffering(true); // BUFFERING
            else setYtBuffering(false);
            if (event.data === 0) handleEnded(); // ENDED
            if (event.data === 1) setState((prev) => ({ ...prev, isPlaying: true }));
            if (event.data === 2) setState((prev) => ({ ...prev, isPlaying: false }));
          },

          // 2/5/100/101/150: bad id, removed video, or embedding blocked.
          onError: () => {
            const dead = videoIdRef.current;
            if (!dead) return;
            setDeadVideos((prev) => (prev.includes(dead) ? prev : [...prev, dead]));
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
    const offset = takeResumeOffset(trackId);
    if (offset) yt.loadVideoById({ videoId: currentVideoId, startSeconds: offset });
    else yt.loadVideoById(currentVideoId);
  }, [currentVideoId, ytReady, trackId, takeResumeOffset]);

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

  // ---- Spotify Web Playback SDK (full tracks for linked Premium accounts) ----
  useEffect(() => {
    spotifyPlayback.onState = (playback) => {
      if (!spotifyActiveRef.current) return;
      if (
        playback.durationSec > 0 &&
        playback.positionSec >= playback.durationSec - 0.5 &&
        playback.paused
      ) {
        handleEnded();
        return;
      }
      setState((prev) => {
        if (!prev.current) return prev;
        const current =
          playback.durationSec && Math.abs(prev.current.durationSec - playback.durationSec) > 1
            ? { ...prev.current, durationSec: Math.round(playback.durationSec) }
            : prev.current;
        const queue =
          current === prev.current
            ? prev.queue
            : prev.queue.map((t, i) => (i === prev.index ? current : t));
        return { ...prev, current, queue, progressSec: playback.positionSec, isPlaying: !playback.paused };
      });
    };
    return () => {
      spotifyPlayback.onState = null;
    };
  }, [handleEnded]);

  useEffect(() => {
    if (!spotifyUri) {
      if (spotifyActiveRef.current) void spotifyPlayback.pause();
      spotifyActiveRef.current = false;
      setSpotifyStreaming(false);
      return;
    }
    if (!readSpotifySession()) {
      // No linked account: the YouTube/preview fallback below takes over silently.
      setSpotifyStreaming(false);
      return;
    }
    let cancelled = false;
    void spotifyPlayback.play(spotifyUri).then((ok) => {
      if (cancelled) return;
      spotifyActiveRef.current = ok;
      setSpotifyStreaming(ok);
      if (!ok) {
        toast("Playing an alternate source", {
          description: "Spotify in-app streaming needs Premium — using a matching stream instead.",

        });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyUri]);

  useEffect(() => {
    if (!useSpotifySdk) return;
    if (state.isPlaying) {
      void spotifyPlayback.resume().then(() => {
        const offset = takeResumeOffset(trackId);
        if (offset) void spotifyPlayback.seek(offset);
      });
    } else void spotifyPlayback.pause();
  }, [state.isPlaying, useSpotifySdk, trackId, takeResumeOffset]);

  useEffect(() => {
    if (!useSpotifySdk) return;
    void spotifyPlayback.setVolume(state.muted ? 0 : state.volume);
  }, [state.volume, state.muted, useSpotifySdk]);

  // Playback clock for sources without a stream or an embedded player.
  useEffect(() => {
    if (!state.isPlaying || !state.current || currentAudioUrl || currentVideoId || useSpotifySdk)
      return;
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
    if (currentAudioUrl || currentVideoId || useSpotifySdk) return;
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

  // Persist the listening position (throttled) so it can be resumed later.
  useEffect(() => {
    if (!user || !state.current || !state.isPlaying) return;
    const now = Date.now();
    if (now - savedAtRef.current < 5000) return;
    savedAtRef.current = now;
    void savePlaybackPosition(user.id, state.current, state.progressSec).catch(() => {});
  }, [user, state.current, state.progressSec, state.isPlaying]);

  // Flush on pause, track change, and when the tab is hidden or closed.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (!user || !state.current) return;
    const track = state.current;
    const position = state.progressSec;
    if (position < 1) return;
    savedAtRef.current = Date.now();
    void savePlaybackPosition(user.id, track, position).catch(() => {});
  };

  useEffect(() => {
    if (!state.isPlaying) flushRef.current();
  }, [state.isPlaying]);

  useEffect(() => () => flushRef.current(), [trackId]);

  useEffect(() => {
    const flush = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

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
          if (videoIdRef.current) ytPlayerRef.current?.seekTo(clamped, true);
          if (spotifyActiveRef.current) void spotifyPlayback.seek(clamped);

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
      playNext: (track) =>
        setState((prev) => {
          if (!prev.queue.length || !prev.current) {
            return { ...prev, queue: [track], index: 0, current: track, progressSec: 0 };
          }
          const queue = [...prev.queue];
          queue.splice(prev.index + 1, 0, track);
          return { ...prev, queue };
        }),
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
      retrySource: () => retrySourceRef.current(),
    }),
    [],
  );

  const value = useMemo(
    () => ({ ...state, ...actions, status, statusLabel, activeSource }),
    [state, actions, status, statusLabel, activeSource],
  );


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
          const offset = takeResumeOffset(state.current?.id);
          if (offset) event.currentTarget.currentTime = offset;
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
        onWaiting={() => setAudioBuffering(true)}
        onStalled={() => setAudioBuffering(true)}
        onCanPlay={() => setAudioBuffering(false)}
        onPlaying={() => setAudioBuffering(false)}
        onPlay={() => setState((prev) => ({ ...prev, isPlaying: true }))}
        onPause={() => !currentVideoId && setState((prev) => ({ ...prev, isPlaying: false }))}
        onError={() => {
          // A dead archive stream shouldn't stop playback: drop the direct URL so
          // the Spotify / YouTube resolvers take over for this track.
          setAudioBuffering(false);
          const track = state.current;
          if (track && rawAudioUrl && !currentVideoId) {
            setDeadAudio((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
          }
        }}


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
