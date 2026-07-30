import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_playlist_tracks",
  title: "List playlist tracks",
  description: "List the tracks inside one of the signed-in user's IMUSIC playlists.",
  inputSchema: {
    playlist_id: z.string().uuid().describe("Playlist id from list_playlists."),
    limit: z.number().int().min(1).max(200).default(100).describe("Max tracks to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ playlist_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("playlist_tracks")
      .select("id,track_id,title,artist,source,duration_sec,position,added_at")
      .eq("playlist_id", playlist_id)
      .order("position", { ascending: true })
      .limit(limit ?? 100);
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
