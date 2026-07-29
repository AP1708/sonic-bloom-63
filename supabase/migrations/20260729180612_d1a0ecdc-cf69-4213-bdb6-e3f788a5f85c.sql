CREATE TABLE public.listening_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  track_id TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artwork_url TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  seconds_played INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_history TO authenticated;
GRANT ALL ON public.listening_history TO service_role;

ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listening_history_own" ON public.listening_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX listening_history_user_played_idx ON public.listening_history (user_id, played_at DESC);
CREATE INDEX listening_history_user_artist_idx ON public.listening_history (user_id, artist);

CREATE TRIGGER update_listening_history_updated_at
  BEFORE UPDATE ON public.listening_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();