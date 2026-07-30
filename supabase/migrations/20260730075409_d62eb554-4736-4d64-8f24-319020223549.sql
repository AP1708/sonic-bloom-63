REVOKE ALL ON public.user_music_connections FROM anon;

DROP POLICY IF EXISTS "user_music_connections_insert_own" ON public.user_music_connections;
DROP POLICY IF EXISTS "user_music_connections_update_own" ON public.user_music_connections;

CREATE POLICY "user_music_connections_insert_own"
ON public.user_music_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_music_connections_update_own"
ON public.user_music_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
