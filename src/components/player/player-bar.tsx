import {
  Heart,
  ListMusic,
  Loader2,
  Maximize2,
  PictureInPicture2,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Artwork, SourceTag } from "@/components/music/artwork";
import { usePlayer } from "./player-provider";
import { usePictureInPicture } from "./pip-player";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PlayerBar({
  liked,
  onToggleLike,
}: {
  liked?: boolean;
  onToggleLike?: () => void;
}) {
  const player = usePlayer();
  const pip = usePictureInPicture();
  const track = player.current;
  const duration = track?.durationSec ?? 0;
  const pct = duration ? (player.progressSec / duration) * 100 : 0;

  return (
    <footer className="z-40 flex h-24 shrink-0 items-center gap-4 border-t border-border bg-surface px-4 lg:px-6">
      <div className="flex w-1/4 min-w-0 items-center gap-3">
        {track ? (
          <>
            <button
              type="button"
              onClick={() => player.setFullscreen(true)}
              aria-label="Open fullscreen player"
              className="shrink-0"
            >
              <Artwork seed={track.id} src={track.artworkUrl} alt="" className="size-14" rounded="rounded-lg" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{track.title}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {player.statusLabel ? (
                  <>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {player.status !== "unavailable" && (
                        <Loader2 className="size-3 shrink-0 animate-spin" />
                      )}
                      <span className="truncate">{player.statusLabel}</span>
                    </span>
                    {player.status === "unavailable" && (
                      <button
                        type="button"
                        onClick={player.retrySource}
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <RotateCw className="size-3" />
                        Retry
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
                    <SourceTag source={track.source} />
                  </>
                )}
              </div>
            </div>

            {onToggleLike && (
              <button
                type="button"
                onClick={onToggleLike}
                aria-label={liked ? "Remove from liked songs" : "Save to liked songs"}
                className={cn(
                  "hidden shrink-0 text-muted-foreground transition-colors hover:text-foreground sm:block",
                  liked && "text-primary hover:text-primary",
                )}
              >
                <Heart className={cn("size-4", liked && "fill-current")} />
              </button>
            )}
          </>
        ) : (
          <p className="label-mono">Nothing playing</p>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={player.toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={player.shuffle}
            className={cn("text-muted-foreground hover:text-foreground", player.shuffle && "text-primary")}
          >
            <Shuffle className="size-4" />
          </button>
          <button
            type="button"
            onClick={player.previous}
            aria-label="Previous track"
            className="text-foreground/80 hover:text-foreground"
          >
            <SkipBack className="size-5" />
          </button>
          <button
            type="button"
            onClick={player.toggle}
            disabled={!track}
            aria-label={player.isPlaying ? "Pause" : "Play"}
            className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {player.status === "buffering" || player.status === "resolving" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : player.isPlaying ? (
              <Pause className="size-5" />
            ) : (
              <Play className="ml-0.5 size-5" />
            )}

          </button>
          <button
            type="button"
            onClick={player.next}
            aria-label="Next track"
            className="text-foreground/80 hover:text-foreground"
          >
            <SkipForward className="size-5" />
          </button>
          <button
            type="button"
            onClick={player.cycleRepeat}
            aria-label={`Repeat: ${player.repeat}`}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              player.repeat !== "off" && "text-primary",
            )}
          >
            {player.repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </button>
        </div>

        <div className="flex w-full max-w-2xl items-center gap-3">
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
      </div>

      <div className="flex w-1/4 items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => player.setPanel("lyrics")}
          aria-label="Toggle lyrics"
          className={cn(
            "hidden text-muted-foreground hover:text-foreground lg:block",
            player.panel === "lyrics" && "text-primary",
          )}
        >
          <Mic2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => player.setPanel("queue")}
          aria-label="Toggle queue"
          className={cn(
            "text-muted-foreground hover:text-foreground",
            player.panel === "queue" && "text-primary",
          )}
        >
          <ListMusic className="size-4" />
        </button>
        <div className="hidden items-center gap-2 lg:flex">
          <button type="button" onClick={player.toggleMute} aria-label="Mute">
            {player.muted ? (
              <VolumeX className="size-4 text-muted-foreground" />
            ) : (
              <Volume2 className="size-4 text-muted-foreground" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.muted ? 0 : player.volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
            aria-label="Volume"
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>
        {pip.supported && (
          <button
            type="button"
            onClick={pip.toggle}
            aria-label={pip.isOpen ? "Close pop-out player" : "Pop out player"}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              pip.isOpen && "text-primary",
            )}
          >
            <PictureInPicture2 className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => player.setFullscreen(true)}
          aria-label="Fullscreen player"
          className="text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    </footer>
  );
}
