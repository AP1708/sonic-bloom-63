import { createFileRoute } from "@tanstack/react-router";

/**
 * Background health check for the YouTube API key pool.
 *
 * Called on a schedule (pg_cron) so keys are probed *before* a listener runs
 * a search: each configured key gets a 1-unit `videos.list` ping, and the
 * result marks it healthy, parked (quota) or unhealthy. Search then rotates
 * healthy keys first instead of discovering exhaustion mid-request.
 *
 * Auth: the caller must present the project publishable key in `apikey`
 * (or `Authorization: Bearer`). Only masked key fingerprints are returned.
 */
export const Route = createFileRoute("/api/public/hooks/youtube-key-health")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request): Promise<Response> {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!expected || provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { probeApiKeys, apiKeys } = await import("@/lib/music/youtube.server");
  if (!apiKeys().length) {
    return Response.json({ ok: false, error: "No YouTube API keys configured", keys: [] });
  }

  const keys = await probeApiKeys();
  const healthy = keys.filter((entry) => entry.healthy).length;
  console.log(`YouTube key health: ${healthy}/${keys.length} healthy`);
  return Response.json({ ok: true, checkedAt: new Date().toISOString(), healthy, keys });
}
