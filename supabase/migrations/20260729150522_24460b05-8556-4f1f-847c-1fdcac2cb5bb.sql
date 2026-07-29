CREATE TABLE public.user_music_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('spotify','youtube')),
  account_label text,
  scopes text,
  token_ciphertext text NOT NULL,
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT SELECT (id, user_id, provider, account_label, scopes, expires_at, last_synced_at, created_at, updated_at) ON public.user_music_connections TO authenticated;
GRANT DELETE ON public.user_music_connections TO authenticated;
GRANT ALL ON public.user_music_connections TO service_role;

ALTER TABLE public.user_music_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_music_connections_select_own ON public.user_music_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY user_music_connections_delete_own ON public.user_music_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_music_connections_updated_at
  BEFORE UPDATE ON public.user_music_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_external_id text;

ALTER TABLE public.playlist_tracks
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS playlists_owner_source_idx
  ON public.playlists (owner_id, source_provider, source_external_id)
  WHERE source_provider IS NOT NULL AND source_external_id IS NOT NULL;