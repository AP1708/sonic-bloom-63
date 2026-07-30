import { createFileRoute } from "@tanstack/react-router";

/**
 * Background health check for the YouTube API key pool.
 *
 * Called on a schedule (pg_cron) so keys are probed *before* a listener runs
 * a search: each configured key gets a 1-unit `videos.list` ping, and the
 * result marks it healthy, parked (quota) or unhealthy. Search then rotates
 * healthy keys first instead of discovering exhaustion mid-request.
 *
 * Auth: the caller must present the private scheduler token in `x-cron-token`.
 * That token lives only in `private.cron_secrets` (no API access) and is
 * verified through a service-role-only database function, so the endpoint
 * cannot be triggered from a browser. Only masked key fingerprints are
 * returned.
 */
export const Route = createFileRoute("/api/public/hooks/youtube-key-health")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});

async function isScheduledCaller(request: Request): Promise<boolean> {
  const token = request.headers.get("x-cron-token") ?? "";
  if (!token) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("verify_cron_token", {
      _name: "youtube_key_health",
      _token: token,
    });
    if (error) {
      console.error(`Cron token verification failed: ${error.message}`);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("Cron token verification threw", error);
    return false;
  }
}

async function run(request: Request): Promise<Response> {
  if (!(await isScheduledCaller(request))) {
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
