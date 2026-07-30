import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_playlist",
  title: "Create playlist",
  description: "Create a new IMUSIC playlist owned by the signed-in user.",
  inputSchema: {
    title: z.string().trim().min(1).max(120).describe("Playlist title."),
    description: z.string().trim().max(500).optional().describe("Optional playlist description."),
    is_public: z.boolean().default(false).describe("Whether the playlist is publicly visible."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, is_public }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("playlists")
      .insert({ owner_id: ctx.getUserId()!, title, description: description ?? null, is_public: is_public ?? false })
      .select("id,title,description,is_public")
      .single();
    if (error) return errorResult(error.message);
    return jsonResult(data);
  },
});
