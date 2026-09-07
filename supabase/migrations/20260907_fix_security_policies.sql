-- Fix permissive RLS policy on profiles table
-- Change the authenticated read policy to only allow users to read their own profile

DROP POLICY IF EXISTS "profiles_authenticated_read" ON public.profiles;

CREATE POLICY "profiles_authenticated_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Ensure no anonymous access to profiles
REVOKE ALL ON public.profiles FROM anon;
