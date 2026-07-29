import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rowToTrack, type SavedTrackRow } from "@/hooks/use-library";
import type { HistoryEntry } from "@/lib/music/taste";
import type { Track } from "@/lib/music/types";

/** Listening history: what was played, for how long, and whether it finished. */

interface HistoryRow extends SavedTrackRow {
  played_at: string;
  seconds_played: number;
  completed: boolean;
}

export const historyKeys = {
  all: (userId: string) => ["listening-history", userId] as const,
};

export function useListeningHistory(userId?: string, limit = 300) {
  return useQuery({
    queryKey: historyKeys.all(userId ?? "anon"),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<HistoryEntry[]> => {
      const { data, error } = await supabase
        .from("listening_history")
        .select("*")
        .order("played_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((raw) => {
        const row = raw as unknown as HistoryRow;
        return {
          track: rowToTrack(row),
          playedAt: new Date(row.played_at).getTime(),
          secondsPlayed: row.seconds_played,
          completed: row.completed,
        };
      });
    },
  });
}

/** Appends one listen. Fire-and-forget: failures never interrupt playback. */
export async function recordListen(
  userId: string,
  track: Track,
  secondsPlayed: number,
  completed: boolean,
) {
  await supabase.from("listening_history").insert({
    user_id: userId,
    track_id: track.id,
    source: track.source,
    title: track.title,
    artist: track.artist,
    artwork_url: track.artworkUrl ?? null,
    duration_sec: track.durationSec,
    seconds_played: Math.max(0, Math.round(secondsPlayed)),
    completed,
  });
}
