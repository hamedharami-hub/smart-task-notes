-- Add task default settings as a JSONB column on user_settings.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS task_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;
