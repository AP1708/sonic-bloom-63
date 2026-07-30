import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reveals more pages of content as a sentinel element scrolls into view.
 * Returns the number of loaded pages plus a ref to attach to the sentinel.
 */
export function useInfiniteScroll({
  totalPages,
  initialPages = 1,
  rootMargin = "600px",
  delayMs = 250,
}: {
  totalPages: number;
  initialPages?: number;
  rootMargin?: string;
  delayMs?: number;
}) {
  const [pages, setPages] = useState(initialPages);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMore = pages < totalPages;

  // Reset when the underlying content set changes size (e.g. mood filter).
  useEffect(() => {
    setPages((current) => Math.min(current, Math.max(initialPages, totalPages)));
  }, [totalPages, initialPages]);

  const loadMore = useCallback(() => {
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPages((current) => Math.min(current + 1, totalPages));
      setLoading(false);
    }, delayMs);
  }, [totalPages, delayMs]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, rootMargin, pages]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { pages, hasMore, loading, sentinelRef };
}
