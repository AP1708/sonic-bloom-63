ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS motion_preference jsonb NOT NULL DEFAULT '{}'::jsonb;