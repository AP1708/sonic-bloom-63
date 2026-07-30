import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "add_track_to_playlist",
  title: "Add track to playlist",
  description: "Append a track to one of the signed-in user's IMUSIC playlists.",
  inputSchema: {
    playlist_id: z.string().uuid().describe("Target playlist id."),
    track_id: z.string().min(1).describe("Track id from search or library results."),
    title: z.string().min(1).describe("Track title."),
    artist: z.string().min(1).describe("Track artist."),
    source: z.string().min(1).default("youtube-music").describe("Source provider, e.g. youtube-music, spotify, archive."),
    duration_sec: z.number().int().min(0).default(0).describe("Track duration in seconds."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ playlist_id, track_id, title, artist, source, duration_sec }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { count } = await supabase
      .from("playlist_tracks")
      .select("id", { count: "exact", head: true })
      .eq("playlist_id", playlist_id);
    const { data, error } = await supabase
      .from("playlist_tracks")
      .insert({
        playlist_id,
        track_id,
        title,
        artist,
        source: source ?? "youtube-music",
        duration_sec: duration_sec ?? 0,
        position: count ?? 0,
        added_by: ctx.getUserId(),
      })
      .select("id,track_id,title,artist,position")
      .single();
    if (error) return errorResult(error.message);
    return jsonResult(data);
  },
});
