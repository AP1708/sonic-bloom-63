import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "recent_listening",
  title: "Recent listening history",
  description: "Show what the signed-in IMUSIC user recently played, newest first.",
  inputSchema: { limit: z.number().int().min(1).max(100).default(25).describe("Max plays to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("listening_history")
      .select("track_id,title,artist,source,seconds_played,duration_sec,completed,played_at")
      .order("played_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
