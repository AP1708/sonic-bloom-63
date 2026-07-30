import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchLyrics, type LyricsResult } from "@/lib/music/lyrics.functions";
import { resolveMusicMetadata } from "@/lib/music/resolve-playback";
import type { Track } from "@/lib/music/types";

/**
 * Lyrics for the currently playing track. Cached aggressively — lyrics never
 * change — and persisted with the rest of the query cache for offline reads.
 *
 * The query is built from the track's YouTube Music metadata when a match
 * exists: Music song titles are clean ("Song Name" / "Artist"), whereas video
 * uploads carry noise that makes LRCLIB miss.
 */
export function useLyrics(track: Track | null) {
  const run = useServerFn(fetchLyrics);
  return useQuery<LyricsResult>({
    queryKey: ["lyrics", track?.id],
    enabled: Boolean(track),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: async () => {
      const meta = await resolveMusicMetadata(track!);
      return run({
        data: {
          title: meta.title,
          artist: meta.artist,
          durationSec: meta.durationSec ? Math.round(meta.durationSec) : undefined,
        },
      });
    },
  });
}
