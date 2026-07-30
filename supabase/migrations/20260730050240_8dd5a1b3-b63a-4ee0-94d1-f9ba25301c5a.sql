CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  event text NOT NULL,
  category text NOT NULL,
  source text,
  track_id text,
  title text,
  artist text,
  query text,
  status text NOT NULL DEFAULT 'ok',
  reason text,
  duration_ms integer,
  result_count integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  client text NOT NULL DEFAULT 'web',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_insert_own"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analytics_events_select_own_or_admin"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX analytics_events_category_created_idx ON public.analytics_events (category, created_at DESC);
CREATE INDEX analytics_events_event_created_idx ON public.analytics_events (event, created_at DESC);
CREATE INDEX analytics_events_source_created_idx ON public.analytics_events (source, created_at DESC);
CREATE INDEX analytics_events_user_created_idx ON public.analytics_events (user_id, created_at DESC);