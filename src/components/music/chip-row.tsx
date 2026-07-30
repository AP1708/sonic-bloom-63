import { cn } from "@/lib/utils";

export interface Mood {
  id: string;
  label: string;
  /** Keywords matched against title / album / artist to shape the feed. */
  keywords: string[];
}

export const MOODS: Mood[] = [
  { id: "all", label: "All", keywords: [] },
  { id: "energise", label: "Energise", keywords: ["dance", "nach", "jhoom", "rangeela", "tez", "chal"] },
  { id: "relax", label: "Relax", keywords: ["raat", "chandni", "sapna", "neend", "shaam", "dheere"] },
  { id: "romance", label: "Romance", keywords: ["pyar", "ishq", "mohabbat", "dil", "prem", "sanam"] },
  { id: "focus", label: "Focus", keywords: ["instrumental", "title music", "theme", "interlude"] },
  { id: "commute", label: "Commute", keywords: ["safar", "raah", "chalo", "duniya", "manzil"] },
  { id: "sad", label: "Feel it all", keywords: ["aansoo", "gham", "dard", "yaad", "tanha", "judai"] },
  { id: "party", label: "Party", keywords: ["mehfil", "sharab", "jashn", "geet", "mast"] },
  { id: "classics", label: "Golden era", keywords: ["1950", "1951", "1952", "1953", "1954", "1955", "1956"] },
];

export function ChipRow({
  active,
  onSelect,
  className,
}: {
  active: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("scroll-rail -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0", className)}>
      {MOODS.map((mood) => {
        const selected = mood.id === active;
        return (
          <button
            key={mood.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(mood.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {mood.label}
          </button>
        );
      })}
    </div>
  );
}
