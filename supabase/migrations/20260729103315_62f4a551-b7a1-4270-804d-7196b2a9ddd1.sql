
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.suspended_until IS NOT NULL AND p.suspended_until > now()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_suspended(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated, service_role;

-- profiles: admins can read/update all
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- playlists visibility excludes hidden for the general public
DROP POLICY IF EXISTS playlists_read_visible ON public.playlists;
CREATE POLICY playlists_read_visible ON public.playlists
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'admin')
    OR ((NOT is_hidden) AND (is_public OR public.can_view_playlist(id, auth.uid())))
  );

DROP POLICY IF EXISTS playlists_insert_own ON public.playlists;
CREATE POLICY playlists_insert_own ON public.playlists
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY IF EXISTS playlists_update_own ON public.playlists;
CREATE POLICY playlists_update_own ON public.playlists
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (auth.uid() = owner_id AND NOT public.is_suspended(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (auth.uid() = owner_id AND NOT public.is_suspended(auth.uid())));

DROP POLICY IF EXISTS playlists_delete_own ON public.playlists;
CREATE POLICY playlists_delete_own ON public.playlists
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- playlist tracks: block suspended users, allow admin cleanup
DROP POLICY IF EXISTS playlist_tracks_insert ON public.playlist_tracks;
CREATE POLICY playlist_tracks_insert ON public.playlist_tracks
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_playlist(playlist_id, auth.uid()) AND auth.uid() = added_by AND NOT public.is_suspended(auth.uid()));

DROP POLICY IF EXISTS playlist_tracks_delete ON public.playlist_tracks;
CREATE POLICY playlist_tracks_delete ON public.playlist_tracks
  FOR DELETE TO authenticated
  USING (public.can_edit_playlist(playlist_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- role management for admins
CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, DELETE ON public.user_roles TO authenticated;
