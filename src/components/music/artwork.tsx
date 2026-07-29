import { Play, Pause } from "lucide-react";
import { hueFor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ArtworkProps {
  seed: string;
  src?: string | null;
  alt: string;
  className?: string;
  rounded?: string;
}

/**
 * Artwork surface. Falls back to a deterministic ambient gradient when a
 * source platform provides no image (or before metadata resolves), so the grid
 * never shows an empty box.
 */
export function Artwork({ seed, src, alt, className, rounded = "rounded-xl" }: ArtworkProps) {
  const hue = hueFor(seed);
  return (
    <div
      className={cn("relative overflow-hidden bg-surface-raised", rounded, className)}
      style={
        src
          ? undefined
          : {
              backgroundImage: `radial-gradient(120% 120% at 20% 10%, oklch(0.55 0.16 ${hue}) 0%, oklch(0.28 0.08 ${(hue + 40) % 360}) 55%, oklch(0.18 0.03 285) 100%)`,
            }
      }
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="sr-only">{alt}</span>
      )}
    </div>
  );
}

export function PlayOverlay({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? "Pause" : "Play"}
      className="absolute inset-0 grid place-items-center bg-background/45 opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100"
    >
      <span className="grid size-12 translate-y-2 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:translate-y-0">
        {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
      </span>
    </button>
  );
}

export function Equalizer({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-3 items-end gap-0.5", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="eq-bar w-0.5 rounded-full bg-primary"
          style={{ height: "100%", animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

export function SourceTag({ source }: { source: "spotify" | "youtube" }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest",
        source === "spotify" ? "bg-spotify/15 text-spotify" : "bg-youtube/15 text-youtube",
      )}
    >
      {source === "spotify" ? "Spotify" : "YouTube"}
    </span>
  );
}
