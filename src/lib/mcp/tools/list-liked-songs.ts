import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_liked_songs",
  title: "List liked songs",
  description: "List songs the signed-in IMUSIC user has liked, newest first.",
  inputSchema: { limit: z.number().int().min(1).max(200).default(50).describe("Max songs to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("liked_songs")
      .select("track_id,title,artist,source,duration_sec,liked_at")
      .order("liked_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
