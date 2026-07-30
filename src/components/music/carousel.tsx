import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Section header in the YouTube Music idiom: a small caption line above a
 * large title, with an optional "More" affordance pinned to the right.
 */
export function SectionHeader({
  title,
  caption,
  moreTo,
  moreLabel = "More",
  action,
}: {
  title: string;
  caption?: string;
  moreTo?: string;
  moreLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {caption && <p className="label-mono mb-1">{caption}</p>}
        <h2 className="truncate text-2xl">{title}</h2>
      </div>
      {action}
      {moreTo && (
        <Link
          to={moreTo}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {moreLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * Horizontal snap-scrolling rail. Arrows appear on hover for pointer devices;
 * touch users just swipe.
 */
export function Carousel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync, children]);

  function scrollBy(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.85), behavior: "smooth" });
  }

  return (
    <div className={cn("group/rail relative", className)}>
      <div
        ref={ref}
        onScroll={sync}
        className="scroll-rail -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1"
      >
        {children}
      </div>

      <RailButton side="left" hidden={atStart} onClick={() => scrollBy(-1)} />
      <RailButton side="right" hidden={atEnd} onClick={() => scrollBy(1)} />
    </div>
  );
}

function RailButton({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  if (hidden) return null;
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-opacity",
        "opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100 lg:grid",
        side === "left" ? "-left-3" : "-right-3",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
