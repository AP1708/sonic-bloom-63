-- 1. Private schema for internal helpers (not exposed via the API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.suspended_until IS NOT NULL AND p.suspended_until > now()) $$;

CREATE OR REPLACE FUNCTION private.can_view_playlist(_playlist_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = _playlist_id
      AND (
        p.is_public
        OR p.owner_id = _user_id
        OR EXISTS (SELECT 1 FROM public.playlist_collaborators c WHERE c.playlist_id = p.id AND c.user_id = _user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.can_edit_playlist(_playlist_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = _playlist_id
      AND (
        p.owner_id = _user_id
        OR (p.is_collaborative AND EXISTS (
          SELECT 1 FROM public.playlist_collaborators c
          WHERE c.playlist_id = p.id AND c.user_id = _user_id
        ))
      )
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_suspended(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_playlist(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_edit_playlist(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_suspended(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_view_playlist(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_edit_playlist(uuid, uuid) TO anon, authenticated, service_role;

-- 2. Recreate policies against the private helpers
DROP POLICY IF EXISTS analytics_events_select_own_or_admin ON public.analytics_events;
CREATE POLICY analytics_events_select_own_or_admin ON public.analytics_events FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS collab_read ON public.playlist_collaborators;
CREATE POLICY collab_read ON public.playlist_collaborators FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR private.can_view_playlist(playlist_id, auth.uid()));

DROP POLICY IF EXISTS playlist_tracks_read ON public.playlist_tracks;
CREATE POLICY playlist_tracks_read ON public.playlist_tracks FOR SELECT
USING (private.can_view_playlist(playlist_id, auth.uid()));

DROP POLICY IF EXISTS playlist_tracks_insert ON public.playlist_tracks;
CREATE POLICY playlist_tracks_insert ON public.playlist_tracks FOR INSERT TO authenticated
WITH CHECK (private.can_edit_playlist(playlist_id, auth.uid()) AND (auth.uid() = added_by) AND (NOT private.is_suspended(auth.uid())));

DROP POLICY IF EXISTS playlist_tracks_update ON public.playlist_tracks;
CREATE POLICY playlist_tracks_update ON public.playlist_tracks FOR UPDATE TO authenticated
USING (private.can_edit_playlist(playlist_id, auth.uid()));

DROP POLICY IF EXISTS playlist_tracks_delete ON public.playlist_tracks;
CREATE POLICY playlist_tracks_delete ON public.playlist_tracks FOR DELETE TO authenticated
USING (private.can_edit_playlist(playlist_id, auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS playlists_read_visible ON public.playlists;
CREATE POLICY playlists_read_visible ON public.playlists FOR SELECT
USING ((auth.uid() = owner_id) OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR ((NOT is_hidden) AND (is_public OR private.can_view_playlist(id, auth.uid()))));

DROP POLICY IF EXISTS playlists_insert_own ON public.playlists;
CREATE POLICY playlists_insert_own ON public.playlists FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = owner_id) AND (NOT private.is_suspended(auth.uid())));

DROP POLICY IF EXISTS playlists_update_own ON public.playlists;
CREATE POLICY playlists_update_own ON public.playlists FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR ((auth.uid() = owner_id) AND (NOT private.is_suspended(auth.uid()))))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR ((auth.uid() = owner_id) AND (NOT private.is_suspended(auth.uid()))));

DROP POLICY IF EXISTS playlists_delete_own ON public.playlists;
CREATE POLICY playlists_delete_own ON public.playlists FOR DELETE TO authenticated
USING ((auth.uid() = owner_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS user_roles_read_own ON public.user_roles;
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
CREATE POLICY user_roles_admin_insert ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;
CREATE POLICY user_roles_admin_delete ON public.user_roles FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Drop the publicly callable SECURITY DEFINER functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_suspended(uuid);
DROP FUNCTION IF EXISTS public.can_view_playlist(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_edit_playlist(uuid, uuid);

-- 4. Remaining public functions must not be directly callable by app users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 5. Column-level security on profiles: hide moderation fields from the API roles
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at, theme_preference, motion_preference)
  ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;