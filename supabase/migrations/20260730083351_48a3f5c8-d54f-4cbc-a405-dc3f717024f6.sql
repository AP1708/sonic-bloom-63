-- Private store for scheduled-job tokens. No API access at all: only
-- SECURITY DEFINER functions owned by the migration role can read it.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_secrets (
  name TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON private.cron_secrets FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.cron_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO private.cron_secrets (name, token)
VALUES ('youtube_key_health', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- Backend-only verifier: compares a presented token against the stored one.
CREATE OR REPLACE FUNCTION public.verify_cron_token(_name TEXT, _token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.cron_secrets
    WHERE name = _name
      AND length(_token) > 0
      AND token = _token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(TEXT, TEXT) TO service_role;

-- Re-point the scheduled health check at the private token instead of the
-- publishable key (which every browser already has).
DO $do$
DECLARE
  v_token TEXT;
BEGIN
  SELECT token INTO v_token FROM private.cron_secrets WHERE name = 'youtube_key_health';

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE command LIKE '%youtube-key-health%';

  PERFORM cron.schedule(
    'youtube-key-health',
    '7 */3 * * *',
    format($job$
      select net.http_post(
        url:='https://project--7fb4b583-4b16-480e-b22b-5638ddb79b10-dev.lovable.app/api/public/hooks/youtube-key-health',
        headers:=%L::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $job$, json_build_object('Content-Type', 'application/json', 'x-cron-token', v_token)::text)
  );
END
$do$;