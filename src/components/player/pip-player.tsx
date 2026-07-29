import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Artwork } from "@/components/music/artwork";
import { formatDuration } from "@/lib/format";
import { usePlayer } from "./player-provider";

interface DocumentPiP {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
}

function getPiP(): DocumentPiP | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture ?? null;
}

/** Copies the app's stylesheets into the picture-in-picture document. */
function cloneStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules).map((rule) => rule.cssText).join("");
      const style = target.document.createElement("style");
      style.textContent = rules;
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin sheet (e.g. Google Fonts) — re-link it instead.
      const href = (sheet as CSSStyleSheet).href;
      if (!href) continue;
      const link = target.document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      target.document.head.appendChild(link);
    }
  }
  target.document.documentElement.className = document.documentElement.className;
  target.document.body.className = "bg-background text-foreground";
}

/**
 * Floating always-on-top mini player. Playback itself keeps running in the main
 * tab, so opening or closing the window never interrupts the audio.
 */
export function usePictureInPicture() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(Boolean(getPiP()));
  }, []);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  const open = useCallback(async () => {
    const pip = getPiP();
    if (!pip) return;
    try {
      const win = await pip.requestWindow({ width: 380, height: 200 });
      cloneStyles(win);
      win.addEventListener("pagehide", () => setPipWindow(null));
      setPipWindow(win);
    } catch {
      // User dismissed the request or the browser refused it.
    }
  }, []);

  const toggle = useCallback(() => {
    if (pipWindow) close();
    else void open();
  }, [pipWindow, close, open]);

  return { supported, isOpen: Boolean(pipWindow), pipWindow, toggle, open, close };
}

export function PiPPortal({ pipWindow }: { pipWindow: Window | null }): ReactNode {
  if (!pipWindow) return null;
  return createPortal(<MiniPlayer />, pipWindow.document.body);
}

function MiniPlayer() {
  const player = usePlayer();
  const track = player.current;
  const duration = track?.durationSec ?? 0;
  const pct = duration ? Math.min(100, (player.progressSec / duration) * 100) : 0;

  if (!track) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Nothing playing
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between gap-3 bg-surface p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Artwork seed={track.id} src={track.artworkUrl} alt="" className="size-14" rounded="rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{track.title}</p>
          <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
          {player.statusLabel && (
            <p className="truncate text-[11px] text-muted-foreground">{player.statusLabel}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          <span>{formatDuration(player.progressSec)}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span>{formatDuration(duration)}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={player.previous} aria-label="Previous track">
            <SkipBack className="size-4 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            type="button"
            onClick={player.toggle}
            aria-label={player.isPlaying ? "Pause" : "Play"}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {player.isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" onClick={player.next} aria-label="Next track">
            <SkipForward className="size-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
