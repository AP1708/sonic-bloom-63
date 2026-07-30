import { useEffect, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { useMotionPrefs } from "@/components/motion/motion-prefs";
import { BADGE_OPTIONS, MOTION_STYLES, type MotionStyle } from "@/lib/motion/motion-prefs";
import { cn } from "@/lib/utils";

const STYLE_LABELS: Record<MotionStyle, string> = {
  rise: "Rise",
  fade: "Fade",
  pop: "Pop",
  slide: "Slide",
  off: "Off",
};

/**
 * Controls for how newly discovered songs animate into the home feed.
 * Shared by the header popover and the settings page.
 */
export function MotionSettings({ compact = false }: { compact?: boolean }) {
  const { prefs, systemReduced, animationsDisabled, setPrefs, reset } = useMotionPrefs();
  // Bumping this key remounts the preview so the animation replays on change.
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    setReplay((n) => n + 1);
  }, [prefs.style, prefs.intensity, prefs.durationMs, prefs.staggerMs]);

  return (
    <div className={cn("flex flex-col gap-5", compact ? "w-72" : "max-w-xl")}>
      <Field label="Style" hint="How a new card arrives">
        <div className="flex flex-wrap gap-1.5">
          {MOTION_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setPrefs({ style })}
              aria-pressed={prefs.style === style}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                prefs.style === style
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {STYLE_LABELS[style]}
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Intensity — ${prefs.intensity}`} hint="Travel distance and scale">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={prefs.intensity}
          onChange={(event) => setPrefs({ intensity: Number(event.target.value) })}
          disabled={prefs.style === "off"}
          className="w-full accent-primary"
          aria-label="Animation intensity"
        />
      </Field>

      <Field label={`Duration — ${prefs.durationMs}ms`} hint="How long one card takes">
        <input
          type="range"
          min={200}
          max={900}
          step={20}
          value={prefs.durationMs}
          onChange={(event) => setPrefs({ durationMs: Number(event.target.value) })}
          disabled={prefs.style === "off"}
          className="w-full accent-primary"
          aria-label="Animation duration"
        />
      </Field>

      <Field label={`Stagger — ${prefs.staggerMs}ms`} hint="Delay between neighbouring cards">
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={prefs.staggerMs}
          onChange={(event) => setPrefs({ staggerMs: Number(event.target.value) })}
          disabled={prefs.style === "off"}
          className="w-full accent-primary"
          aria-label="Animation stagger"
        />
      </Field>

      <Field label={'"New" badge'} hint="How long the marker stays">
        <div className="flex flex-wrap gap-1.5">
          {BADGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPrefs({ badgeMs: option.value })}
              aria-pressed={prefs.badgeMs === option.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                prefs.badgeMs === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>

      <label className="flex items-start gap-3 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={prefs.respectReducedMotion}
          onChange={(event) => setPrefs({ respectReducedMotion: event.target.checked })}
          className="mt-0.5 size-4 accent-primary"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Respect system reduced-motion</span>
          <span className="text-xs text-muted-foreground">
            {systemReduced
              ? prefs.respectReducedMotion
                ? "Your device asks for reduced motion, so animations are off."
                : "Overriding your device's reduced-motion setting."
              : "Your device isn't asking for reduced motion right now."}
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="label-mono text-[10px] text-muted-foreground">Preview</span>
        <div key={replay} className="flex gap-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                "relative h-14 w-14 rounded-lg bg-surface-raised",
                !animationsDisabled && "card-enter",
              )}
              style={{
                animationDelay: `calc(${index} * var(--anim-card-stagger, 40ms))`,
              }}
            >
              <Sparkles className="absolute inset-0 m-auto size-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        className="flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <RotateCcw className="size-3.5" /> Reset to defaults
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
