CREATE TABLE public.playback_positions (
  user_id uuid NOT NULL,
  track_id text NOT NULL,
  source text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  artwork_url text,
  duration_sec integer NOT NULL DEFAULT 0,
  position_sec integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playback_positions TO authenticated;
GRANT ALL ON public.playback_positions TO service_role;

ALTER TABLE public.playback_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playback_positions_own"
  ON public.playback_positions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX playback_positions_recent_idx
  ON public.playback_positions (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_playback_positions_updated_at
  BEFORE UPDATE ON public.playback_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();