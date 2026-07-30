import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_playlists",
  title: "List playlists",
  description: "List the signed-in IMUSIC user's playlists with track counts.",
  inputSchema: { limit: z.number().int().min(1).max(100).default(25).describe("Max playlists to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("playlists")
      .select("id,title,description,is_public,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return errorResult(error.message);
    return jsonResult(data ?? []);
  },
});
