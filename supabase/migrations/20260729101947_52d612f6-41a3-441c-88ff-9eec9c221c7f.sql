-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- PROFILE AUTO-CREATE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PLAYLISTS
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  is_public boolean NOT NULL DEFAULT false,
  is_collaborative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.playlists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.playlist_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.playlist_collaborators TO authenticated;
GRANT ALL ON public.playlist_collaborators TO service_role;
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_playlist(_playlist_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.can_view_playlist(_playlist_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

CREATE POLICY "playlists_read_visible" ON public.playlists FOR SELECT
  USING (is_public OR auth.uid() = owner_id OR public.can_view_playlist(id, auth.uid()));
CREATE POLICY "playlists_insert_own" ON public.playlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "playlists_update_own" ON public.playlists FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "playlists_delete_own" ON public.playlists FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "collab_read" ON public.playlist_collaborators FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_view_playlist(playlist_id, auth.uid()));
CREATE POLICY "collab_insert_owner" ON public.playlist_collaborators FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid()));
CREATE POLICY "collab_delete_owner_or_self" ON public.playlist_collaborators FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid()));

CREATE TABLE public.playlist_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  source text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  artwork_url text,
  duration_sec integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.playlist_tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_tracks TO authenticated;
GRANT ALL ON public.playlist_tracks TO service_role;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlist_tracks_read" ON public.playlist_tracks FOR SELECT
  USING (public.can_view_playlist(playlist_id, auth.uid()));
CREATE POLICY "playlist_tracks_insert" ON public.playlist_tracks FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_playlist(playlist_id, auth.uid()) AND auth.uid() = added_by);
CREATE POLICY "playlist_tracks_update" ON public.playlist_tracks FOR UPDATE TO authenticated
  USING (public.can_edit_playlist(playlist_id, auth.uid()));
CREATE POLICY "playlist_tracks_delete" ON public.playlist_tracks FOR DELETE TO authenticated
  USING (public.can_edit_playlist(playlist_id, auth.uid()));

-- LIKED SONGS
CREATE TABLE public.liked_songs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  source text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  artwork_url text,
  duration_sec integer NOT NULL DEFAULT 0,
  liked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liked_songs TO authenticated;
GRANT ALL ON public.liked_songs TO service_role;
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "liked_songs_own" ON public.liked_songs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RECENTLY PLAYED
CREATE TABLE public.recently_played (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  source text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  artwork_url text,
  duration_sec integer NOT NULL DEFAULT 0,
  played_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recently_played_user_time_idx ON public.recently_played (user_id, played_at DESC);
GRANT SELECT, INSERT, DELETE ON public.recently_played TO authenticated;
GRANT ALL ON public.recently_played TO service_role;
ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recently_played_own" ON public.recently_played FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);