DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;

REVOKE ALL ON public.profiles FROM anon;

CREATE POLICY "profiles_authenticated_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
