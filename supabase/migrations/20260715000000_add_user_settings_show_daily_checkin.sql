-- Toggle to show/hide the daily check-in prompt card and auto-created task
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS show_daily_checkin BOOLEAN DEFAULT true;
