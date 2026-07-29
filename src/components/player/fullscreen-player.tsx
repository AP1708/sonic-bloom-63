import {
  ChevronDown,
  Loader2,
  Pause,
  Play,
  RotateCw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Artwork, SourceTag } from "@/components/music/artwork";
import { usePlayer } from "./player-provider";
import { formatDuration } from "@/lib/format";
import { hueFor } from "@/lib/format";

export function FullscreenPlayer() {
  const player = usePlayer();
  if (!player.fullscreen || !player.current) return null;
  const track = player.current;
  const hue = hueFor(track.id);
  const duration = track.durationSec;
  const pct = duration ? (player.progressSec / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(80% 60% at 50% 0%, oklch(0.32 0.1 ${hue}) 0%, transparent 70%)`,
          opacity: "var(--player-glow-opacity)",
        }}
      />
      <header className="relative flex items-center justify-between px-6 py-5">
        <span className="label-mono">Now playing</span>
        <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => player.setFullscreen(false)}
          aria-label="Close fullscreen player"
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="size-6" />
        </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <Artwork
          seed={track.id}
          src={track.artworkUrl}
          alt=""
          className="aspect-square w-full max-w-sm shadow-2xl"
          rounded="rounded-2xl"
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl">{track.title}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">{track.artist}</p>
            <SourceTag source={track.source} />
          </div>
          {player.statusLabel && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {player.status !== "unavailable" && <Loader2 className="size-3.5 animate-spin" />}
              <span>{player.statusLabel}</span>
              {player.status === "unavailable" && (
                <button
                  type="button"
                  onClick={player.retrySource}
                  className="flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <RotateCw className="size-3.5" />
                  Retry
                </button>
              )}
            </div>
          )}
        </div>


        <div className="flex w-full max-w-lg items-center gap-3">
          <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">
            {formatDuration(player.progressSec)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            value={player.progressSec}
            onChange={(event) => player.seek(Number(event.target.value))}
            aria-label="Seek"
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            style={{
              backgroundImage: `linear-gradient(to right, var(--primary) ${pct}%, transparent ${pct}%)`,
            }}
          />
          <span className="w-10 font-mono text-[10px] text-muted-foreground">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="mb-14 flex items-center gap-8">
          <button type="button" onClick={player.previous} aria-label="Previous track">
            <SkipBack className="size-6" />
          </button>
          <button
            type="button"
            onClick={player.toggle}
            aria-label={player.isPlaying ? "Pause" : "Play"}
            className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          >
            {player.isPlaying ? <Pause className="size-7" /> : <Play className="ml-1 size-7" />}
          </button>
          <button type="button" onClick={player.next} aria-label="Next track">
            <SkipForward className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
