import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/lib/music/types";
import { audioUrlFor } from "@/lib/music/catalog";

export interface PlaylistRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  is_collaborative: boolean;
  created_at: string;
}

export interface SavedTrackRow {
  track_id: string;
  source: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  duration_sec: number;
}

export function rowToTrack(row: SavedTrackRow): Track {
  const source: Track["source"] =
    row.source === "spotify" ? "spotify" : row.source === "archive" ? "archive" : "youtube";
  return {
    id: row.track_id,
    source,
    title: row.title,
    artist: row.artist,
    artworkUrl: row.artwork_url,
    durationSec: row.duration_sec,
    // Saved rows store metadata only; re-attach the stream for archive recordings.
    audioUrl: audioUrlFor(row.track_id),
  };
}

function trackToRow(track: Track) {
  return {
    track_id: track.id,
    source: track.source,
    title: track.title,
    artist: track.artist,
    artwork_url: track.artworkUrl ?? null,
    duration_sec: track.durationSec,
  };
}

export const libraryKeys = {
  playlists: (userId: string) => ["playlists", userId] as const,
  playlist: (id: string) => ["playlist", id] as const,
  playlistTracks: (id: string) => ["playlist-tracks", id] as const,
  liked: (userId: string) => ["liked", userId] as const,
  recent: (userId: string) => ["recently-played", userId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
};

export function usePlaylists(userId?: string) {
  return useQuery({
    queryKey: libraryKeys.playlists(userId ?? "anon"),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlaylistRow[];
    },
  });
}

export function usePlaylist(playlistId: string) {
  return useQuery({
    queryKey: libraryKeys.playlist(playlistId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("id", playlistId)
        .maybeSingle();
      if (error) throw error;
      return data as PlaylistRow | null;
    },
  });
}

export function usePlaylistTracks(playlistId: string) {
  return useQuery({
    queryKey: libraryKeys.playlistTracks(playlistId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_tracks")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => rowToTrack(row as unknown as SavedTrackRow));
    },
  });
}

export function useLikedSongs(userId?: string) {
  return useQuery({
    queryKey: libraryKeys.liked(userId ?? "anon"),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liked_songs")
        .select("*")
        .order("liked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => rowToTrack(row as unknown as SavedTrackRow));
    },
  });
}

export function useRecentlyPlayed(userId?: string) {
  return useQuery({
    queryKey: libraryKeys.recent(userId ?? "anon"),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recently_played")
        .select("*")
        .order("played_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => rowToTrack(row as unknown as SavedTrackRow));
    },
  });
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: libraryKeys.notifications(userId ?? "anon"),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleLike(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ track, liked }: { track: Track; liked: boolean }) => {
      if (!userId) throw new Error("Sign in to save songs to your library.");
      if (liked) {
        const { error } = await supabase
          .from("liked_songs")
          .delete()
          .eq("user_id", userId)
          .eq("track_id", track.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("liked_songs")
        .upsert({ user_id: userId, ...trackToRow(track) });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.liked(userId ?? "anon") });
    },
  });
}

export function useCreatePlaylist(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; collaborative?: boolean }) => {
      if (!userId) throw new Error("Sign in to create playlists.");
      const { data, error } = await supabase
        .from("playlists")
        .insert({
          owner_id: userId,
          title: input.title,
          description: input.description ?? null,
          is_collaborative: input.collaborative ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PlaylistRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.playlists(userId ?? "anon") });
    },
  });
}

export function useAddTrackToPlaylist(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      track,
      position,
    }: {
      playlistId: string;
      track: Track;
      position: number;
    }) => {
      if (!userId) throw new Error("Sign in to edit playlists.");
      const { error } = await supabase.from("playlist_tracks").insert({
        playlist_id: playlistId,
        added_by: userId,
        position,
        ...trackToRow(track),
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.playlistTracks(variables.playlistId) });
    },
  });
}

export function useRemovePlaylistTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      const { error } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.playlistTracks(variables.playlistId) });
    },
  });
}

export async function recordPlay(userId: string, track: Track) {
  await supabase.from("recently_played").insert({ user_id: userId, ...trackToRow(track) });
}

/** Creates a playlist and bulk-inserts an imported track list in one go. */
export function useImportPlaylist(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string | null;
      tracks: Track[];
    }) => {
      if (!userId) throw new Error("Sign in to import playlists.");
      const { data, error } = await supabase
        .from("playlists")
        .insert({
          owner_id: userId,
          title: input.title,
          description: input.description ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const playlist = data as PlaylistRow;
      if (input.tracks.length) {
        const rows = input.tracks.map((track, position) => ({
          playlist_id: playlist.id,
          added_by: userId,
          position,
          ...trackToRow(track),
        }));
        const { error: trackError } = await supabase.from("playlist_tracks").insert(rows);
        if (trackError) throw trackError;
      }
      return playlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.playlists(userId ?? "anon") });
    },
  });
}
