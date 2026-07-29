import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchLyrics, type LyricsResult } from "@/lib/music/lyrics.functions";
import type { Track } from "@/lib/music/types";

/**
 * Lyrics for the currently playing track. Cached aggressively — lyrics never
 * change — and persisted with the rest of the query cache for offline reads.
 */
export function useLyrics(track: Track | null) {
  const run = useServerFn(fetchLyrics);
  return useQuery<LyricsResult>({
    queryKey: ["lyrics", track?.id],
    enabled: Boolean(track),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: () =>
      run({
        data: {
          title: track!.title,
          artist: track!.artist,
          durationSec: track!.durationSec ? Math.round(track!.durationSec) : undefined,
        },
      }),
  });
}
