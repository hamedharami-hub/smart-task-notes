-- ==========================================
-- ARSHNAZ FULL DATABASE SCHEMA & MIGRATIONS
-- Run this in Supabase SQL Editor
-- ==========================================

-- --- Migration: 20260420220125_69868847-415f-4be9-a2e7-7635d8c41a16.sql ---

-- =========================
-- Helper: updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================
-- profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- folders (tree)
-- =========================
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own folders" ON public.folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_folders_user ON public.folders(user_id);
CREATE INDEX idx_folders_parent ON public.folders(parent_id);
CREATE TRIGGER trg_folders_updated BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- tags
-- =========================
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags" ON public.tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- tasks
-- =========================
CREATE TYPE public.task_priority AS ENUM ('none', 'low', 'medium', 'high');
CREATE TYPE public.recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'none',
  due_date TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  recurrence public.recurrence_type NOT NULL DEFAULT 'none',
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tasks_user ON public.tasks(user_id);
CREATE INDEX idx_tasks_folder ON public.tasks(folder_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- subtasks
-- =========================
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subtasks" ON public.subtasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_subtasks_task ON public.subtasks(task_id);

-- =========================
-- task_tags
-- =========================
CREATE TABLE public.task_tags (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own task_tags" ON public.task_tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- notes
-- =========================
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notes_user ON public.notes(user_id);
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- note_tags
-- =========================
CREATE TABLE public.note_tags (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own note_tags" ON public.note_tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- habits
-- =========================
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habits" ON public.habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(habit_id, log_date)
);
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habit_logs" ON public.habit_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- pomodoro_sessions
-- =========================
CREATE TABLE public.pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_minutes INT NOT NULL DEFAULT 25,
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pomodoro" ON public.pomodoro_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- --- Migration: 20260421000642_75e2722e-147f-47a8-af64-44dcb088bc3b.sql ---

-- Add task_id to notes (multi-notes per task)
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notes_task_id ON public.notes(task_id);

-- Add advanced recurrence rule to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;

-- Create private bucket for note media
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-media', 'note-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for note-media: users can manage files only in their own folder
CREATE POLICY "Users read own media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- --- Migration: 20260421003330_53bd3066-45ae-4971-b335-683be10948c1.sql ---

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_id);

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.subtasks REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- --- Migration: 20260421004749_d89e3512-ac3d-4f75-bc23-e4352d0f8b4d.sql ---
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status public.task_status NOT NULL DEFAULT 'todo';

-- Backfill: completed tasks become 'done'
UPDATE public.tasks SET status = 'done' WHERE completed = true;

-- --- Migration: 20260421043940_4c55848e-bb4b-4b47-8f04-2cacf4022235.sql ---
-- Folder kanban columns (custom per-folder columns)
CREATE TABLE public.folder_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folder_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folder_columns"
  ON public.folder_columns FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_folder_columns_folder ON public.folder_columns(folder_id, position);

CREATE TRIGGER update_folder_columns_updated_at
  BEFORE UPDATE ON public.folder_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add kanban_column_id to tasks (links task to a folder's custom column)
ALTER TABLE public.tasks ADD COLUMN kanban_column_id UUID;
CREATE INDEX idx_tasks_kanban_column ON public.tasks(kanban_column_id);

-- User AI preferences (language for AI output)
ALTER TABLE public.profiles ADD COLUMN ai_language TEXT NOT NULL DEFAULT 'fa';

-- --- Migration: 20260421045737_b7708ad2-ab14-4298-abd8-77c4a28ac671.sql ---
ALTER PUBLICATION supabase_realtime ADD TABLE public.folder_columns;
ALTER TABLE public.folder_columns REPLICA IDENTITY FULL;

-- --- Migration: 20260421061101_f39eade8-540a-4a26-8f53-0cd7f00078b7.sql ---
-- Goals table
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#F59E0B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
ON public.goals FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN goal_id UUID,
  ADD COLUMN goal_level TEXT,
  ADD COLUMN quadrant SMALLINT;

CREATE INDEX idx_tasks_goal_id ON public.tasks(goal_id);

-- Holidays table (public read, service-role write)
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  country_code TEXT NOT NULL,
  name TEXT NOT NULL,
  local_name TEXT,
  type TEXT DEFAULT 'national',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, country_code, name)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view holidays"
ON public.holidays FOR SELECT
USING (true);

CREATE INDEX idx_holidays_date_country ON public.holidays(date, country_code);

-- --- Migration: 20260421061158_56818015-beef-4443-ad88-84d9cf7d9b0c.sql ---
-- Allow authenticated users (via edge function) to insert/update holidays
CREATE POLICY "Authenticated can insert holidays"
ON public.holidays FOR INSERT
TO authenticated
WITH CHECK (true);

-- --- Migration: 20260421061217_905bcce3-45ea-4922-9b58-e6ea558c8a11.sql ---
DROP POLICY IF EXISTS "Authenticated can insert holidays" ON public.holidays;

-- --- Migration: 20260421061955_149021ad-8e73-442e-afe7-0ad92055fcef.sql ---
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS sr_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sr_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sr_ease numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS sr_reps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sr_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS sr_last_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notes_sr_due ON public.notes(user_id, sr_due_date) WHERE sr_enabled = true;

-- --- Migration: 20260421065940_433f1f85-2484-4b3e-a0b7-d220ec37808b.sql ---

-- Assessment in-progress responses (for split sessions)
CREATE TABLE public.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_type text NOT NULL, -- 'hexaco' | 'via' | 'ecr'
  responses jsonb NOT NULL DEFAULT '{}'::jsonb, -- { questionId: answer }
  completed boolean NOT NULL DEFAULT false,
  current_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, assessment_type)
);

ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assessment_responses" ON public.assessment_responses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_assessment_responses_updated_at
  BEFORE UPDATE ON public.assessment_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Final assessment results
CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_type text NOT NULL,
  scores jsonb NOT NULL, -- e.g. { H: 32, E: 18, X: 35, A: 28, C: 45, O: 42 }
  analysis jsonb, -- patterns, attention points, ai_tone
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assessment_results" ON public.assessment_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_assessment_results_user_type ON public.assessment_results(user_id, assessment_type, completed_at DESC);

-- Mental health profile (aggregated)
CREATE TABLE public.mh_profile (
  user_id uuid PRIMARY KEY,
  ai_tone text NOT NULL DEFAULT 'neutral', -- 'data_driven' | 'gentle_analytical' | 'exploratory' | 'neutral'
  signature_strengths jsonb DEFAULT '[]'::jsonb, -- top 5 VIA strengths
  hexaco_pattern text, -- e.g. 'High-Functioning Analytical'
  attachment_quadrant text, -- 'secure' | 'preoccupied' | 'dismissive' | 'fearful'
  attention_points jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mh_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mh_profile" ON public.mh_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_mh_profile_updated_at
  BEFORE UPDATE ON public.mh_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily check-ins
CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  mood smallint, -- 1..10
  energy smallint, -- 1..10
  focus smallint, -- 1..10
  sleep_hours numeric(3,1),
  sleep_quality smallint, -- 1..10
  stress smallint, -- 1..10
  notes text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily_checkins" ON public.daily_checkins
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_checkins_updated_at
  BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date DESC);


-- --- Migration: 20260421071721_2920dabf-b0d4-4845-8a7a-bf8926992787.sql ---

-- Thought Records (CBT)
CREATE TABLE public.thought_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  situation TEXT NOT NULL,
  automatic_thought TEXT NOT NULL,
  emotion_intensity_before SMALLINT NOT NULL CHECK (emotion_intensity_before BETWEEN 0 AND 100),
  emotions TEXT[] DEFAULT '{}',
  evidence_for TEXT[] DEFAULT '{}',
  evidence_against TEXT[] DEFAULT '{}',
  alternative_thought TEXT,
  emotion_intensity_after SMALLINT CHECK (emotion_intensity_after BETWEEN 0 AND 100),
  distortions TEXT[] DEFAULT '{}',
  ai_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.thought_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own thought_records" ON public.thought_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_thought_records_updated_at BEFORE UPDATE ON public.thought_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ABC Model Records
CREATE TABLE public.abc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger TEXT NOT NULL,
  belief TEXT NOT NULL,
  consequences TEXT[] DEFAULT '{}',
  duration_minutes INTEGER,
  regret_level SMALLINT CHECK (regret_level BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.abc_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own abc_records" ON public.abc_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Prediction Journal
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  predicted_work_hours NUMERIC,
  actual_work_hours NUMERIC,
  predicted_productivity SMALLINT CHECK (predicted_productivity BETWEEN 1 AND 10),
  actual_productivity SMALLINT CHECK (actual_productivity BETWEEN 1 AND 10),
  predicted_completion_pct SMALLINT,
  actual_completion_pct SMALLINT,
  hardest_part TEXT,
  evening_reflection TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, prediction_date)
);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own predictions" ON public.predictions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User Values (ACT)
CREATE TABLE public.user_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  value_name TEXT NOT NULL,
  meaning TEXT,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own user_values" ON public.user_values FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chronotype (MEQ)
CREATE TABLE public.chronotype (
  user_id UUID PRIMARY KEY,
  meq_score SMALLINT,
  category TEXT,
  peak_window_start SMALLINT,
  peak_window_end SMALLINT,
  trough_window_start SMALLINT,
  trough_window_end SMALLINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chronotype ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chronotype" ON public.chronotype FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Safe Contacts
CREATE TABLE public.safe_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.safe_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own safe_contacts" ON public.safe_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Crisis Events Log
CREATE TABLE public.crisis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  steps_taken JSONB DEFAULT '[]',
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own crisis_events" ON public.crisis_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- --- Migration: 20260422032653_a7075556-d4ea-4aed-bbbf-2e3e5c9a7b24.sql ---
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS clinical_consent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS clinical_consent_at timestamptz;

-- --- Migration: 20260422035320_f90a3982-d225-4142-9465-8ea555b3556e.sql ---
-- B1: Sleep logs
CREATE TABLE public.sleep_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sleep_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bedtime TIME,
  wake_time TIME,
  hours NUMERIC(4,2),
  quality SMALLINT CHECK (quality BETWEEN 1 AND 5),
  awakenings SMALLINT DEFAULT 0,
  caffeine_cutoff_hour SMALLINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sleep_date)
);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sleep_logs"
ON public.sleep_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sleep_logs_updated_at
BEFORE UPDATE ON public.sleep_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sleep_logs_user_date ON public.sleep_logs(user_id, sleep_date DESC);

-- B3: Progressive profiling queue
CREATE TABLE public.profile_questions_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  scale_min SMALLINT NOT NULL DEFAULT 1,
  scale_max SMALLINT NOT NULL DEFAULT 5,
  reverse_scored BOOLEAN NOT NULL DEFAULT false,
  trait TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  answer SMALLINT,
  asked_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  trigger_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_questions_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile_questions_queue"
ON public.profile_questions_queue FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pqq_user_status ON public.profile_questions_queue(user_id, status, scheduled_for);

-- B5: Decision journal
CREATE TABLE public.decision_journal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  decision_title TEXT NOT NULL,
  context TEXT,
  options_considered JSONB DEFAULT '[]'::jsonb,
  chosen_option TEXT,
  rationale TEXT,
  predicted_outcome TEXT,
  predicted_confidence SMALLINT CHECK (predicted_confidence BETWEEN 0 AND 100),
  emotional_state TEXT,
  review_date DATE,
  actual_outcome TEXT,
  outcome_rating SMALLINT CHECK (outcome_rating BETWEEN 1 AND 5),
  lessons_learned TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own decision_journal"
ON public.decision_journal FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_decision_journal_updated_at
BEFORE UPDATE ON public.decision_journal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_decision_journal_user ON public.decision_journal(user_id, created_at DESC);
CREATE INDEX idx_decision_journal_review ON public.decision_journal(user_id, review_date) WHERE reviewed_at IS NULL;

-- --- Migration: 20260422041617_377902ac-95ac-49f4-9cb4-8ed993a23e83.sql ---
CREATE TABLE public.user_settings (
  user_id uuid NOT NULL PRIMARY KEY,
  sleep_reminder_enabled boolean NOT NULL DEFAULT true,
  sleep_reminder_time time NOT NULL DEFAULT '22:00',
  checkin_reminder_enabled boolean NOT NULL DEFAULT true,
  checkin_reminder_time time NOT NULL DEFAULT '21:00',
  notifications_enabled boolean NOT NULL DEFAULT false,
  sleep_goal_hours numeric NOT NULL DEFAULT 7.5,
  micro_prompt_enabled boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'system',
  auto_create_daily_tasks boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- Migration: 20260422072509_8e9e3872-b90c-4632-80e8-8cf8035d2acf.sql ---
-- 1) Extend user_settings with UI scale + font size
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS font_size text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS ui_scale numeric NOT NULL DEFAULT 1.0;

-- 2) About-me table (single row per user)
CREATE TABLE IF NOT EXISTS public.about_me (
  user_id uuid PRIMARY KEY,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  free_text text,
  ai_analysis jsonb,
  ai_suggestions jsonb,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.about_me ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own about_me"
ON public.about_me
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_about_me_updated_at
BEFORE UPDATE ON public.about_me
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --- Migration: 20260422131234_f4aa2f6f-0918-4c11-b66a-535998c3d11c.sql ---
-- Task widgets table (saved task views)
CREATE TABLE public.task_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all', -- all | today | next7 | inbox | folder | tag | smart
  folder_id UUID NULL,
  tag_id UUID NULL,
  sort_by TEXT NOT NULL DEFAULT 'created_desc', -- created_desc | created_asc | due_asc | due_desc | priority | title
  date_filter TEXT NOT NULL DEFAULT 'all', -- all | today | overdue | this_week | this_month | no_date
  show_completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  icon TEXT NULL,
  color TEXT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task_widgets"
ON public.task_widgets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_task_widgets_updated_at
BEFORE UPDATE ON public.task_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add default widget + card layout to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS default_widget_id UUID NULL,
ADD COLUMN IF NOT EXISTS task_card_layout TEXT NOT NULL DEFAULT 'comfortable',
ADD COLUMN IF NOT EXISTS default_landing TEXT NOT NULL DEFAULT 'today'; -- today | widget | last

-- --- Migration: 20260423031136_72b41c34-d75f-477a-888a-719c6bee2c6d.sql ---
CREATE TABLE public.task_step_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT 'numbered',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_step_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task_step_lists"
ON public.task_step_lists FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_task_step_lists_updated_at
BEFORE UPDATE ON public.task_step_lists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_task_step_lists_task ON public.task_step_lists(task_id);

CREATE TABLE public.task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  list_id UUID NOT NULL REFERENCES public.task_step_lists(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task_steps"
ON public.task_steps FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_task_steps_updated_at
BEFORE UPDATE ON public.task_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_task_steps_list ON public.task_steps(list_id);

-- --- Migration: 20260423032646_bda77c5c-1ea2-40bb-9371-5d5a071ece68.sql ---

CREATE TABLE public.task_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  url text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  kind text NOT NULL DEFAULT 'file',
  size_bytes bigint,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task_attachments"
ON public.task_attachments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_task_attachments_task ON public.task_attachments(task_id);

-- Storage policies for note-media bucket so users can upload/read/delete their own files (folder = user_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='note-media own read') THEN
    CREATE POLICY "note-media own read" ON storage.objects FOR SELECT
      USING (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='note-media own insert') THEN
    CREATE POLICY "note-media own insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='note-media own delete') THEN
    CREATE POLICY "note-media own delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'note-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END$$;


-- --- Migration: 20260424035612_0b02d469-7472-4870-9ef4-d434575a58bc.sql ---
CREATE TABLE public.widget_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone
);

ALTER TABLE public.widget_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own widget_tokens"
ON public.widget_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_widget_tokens_token ON public.widget_tokens(token);

-- --- Migration: 20260424052839_2cf9b331-afb7-4add-a4ac-2661cbf2346d.sql ---
DROP TABLE IF EXISTS public.predictions CASCADE;
DROP TABLE IF EXISTS public.user_values CASCADE;
DROP TABLE IF EXISTS public.chronotype CASCADE;
DROP TABLE IF EXISTS public.sleep_logs CASCADE;
DROP TABLE IF EXISTS public.crisis_events CASCADE;
DROP TABLE IF EXISTS public.safe_contacts CASCADE;

-- --- Migration: 20260424224957_6024560e-866d-4ba6-9f00-d775aafce188.sql ---
-- 1) Drop unused sleep-related columns from user_settings
ALTER TABLE public.user_settings 
  DROP COLUMN IF EXISTS sleep_reminder_time,
  DROP COLUMN IF EXISTS sleep_reminder_enabled,
  DROP COLUMN IF EXISTS sleep_goal_hours;

-- 2) Performance indexes
-- Tasks: hottest queries (today, by folder, by goal, by user)
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date
  ON public.tasks (user_id, due_date) WHERE completed = false;

CREATE INDEX IF NOT EXISTS idx_tasks_user_completed
  ON public.tasks (user_id, completed, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_user_folder
  ON public.tasks (user_id, folder_id) WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_goal
  ON public.tasks (user_id, goal_id) WHERE goal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_kanban
  ON public.tasks (kanban_column_id) WHERE kanban_column_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_reminder
  ON public.tasks (user_id, reminder_at) WHERE reminder_at IS NOT NULL;

-- Notes
CREATE INDEX IF NOT EXISTS idx_notes_user_updated
  ON public.notes (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user_folder
  ON public.notes (user_id, folder_id) WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_user_sr_due
  ON public.notes (user_id, sr_due_date) WHERE sr_enabled = true;

-- Daily checkins
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date
  ON public.daily_checkins (user_id, checkin_date DESC);

-- Habit logs
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date
  ON public.habit_logs (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date
  ON public.habit_logs (habit_id, log_date DESC);

-- Pomodoro sessions
CREATE INDEX IF NOT EXISTS idx_pomodoro_user_started
  ON public.pomodoro_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pomodoro_task
  ON public.pomodoro_sessions (task_id) WHERE task_id IS NOT NULL;

-- Subtasks / steps
CREATE INDEX IF NOT EXISTS idx_subtasks_task
  ON public.subtasks (task_id, position);

CREATE INDEX IF NOT EXISTS idx_task_step_lists_task
  ON public.task_step_lists (task_id, position);

CREATE INDEX IF NOT EXISTS idx_task_steps_list
  ON public.task_steps (list_id, position);

-- ABC / Thought records / Decisions (analysis pages)
CREATE INDEX IF NOT EXISTS idx_abc_user_created
  ON public.abc_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thought_records_user_created
  ON public.thought_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_journal_user_created
  ON public.decision_journal (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_journal_review
  ON public.decision_journal (user_id, review_date) WHERE review_date IS NOT NULL;

-- Tags & folder relations
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON public.task_tags (task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON public.task_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note ON public.note_tags (note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON public.note_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_folders_user_parent
  ON public.folders (user_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_folder_columns_folder
  ON public.folder_columns (folder_id, position);

-- Profile questions queue
CREATE INDEX IF NOT EXISTS idx_pqq_user_status
  ON public.profile_questions_queue (user_id, status, scheduled_for);

-- Assessment responses lookup
CREATE INDEX IF NOT EXISTS idx_assessment_responses_user_type
  ON public.assessment_responses (user_id, assessment_type);

CREATE INDEX IF NOT EXISTS idx_assessment_results_user_type
  ON public.assessment_results (user_id, assessment_type, completed_at DESC);

-- Widget tokens lookup (used by public widget endpoint)
CREATE INDEX IF NOT EXISTS idx_widget_tokens_token
  ON public.widget_tokens (token);

-- Task widgets per user
CREATE INDEX IF NOT EXISTS idx_task_widgets_user_position
  ON public.task_widgets (user_id, position);


-- --- Migration: 20260424233448_a718a95f-807f-4415-974b-d851a602b2a3.sql ---
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

CREATE INDEX IF NOT EXISTS idx_tasks_start_at ON public.tasks(user_id, start_at) WHERE start_at IS NOT NULL;

-- --- Migration: 20260425124548_91563495-4546-496d-8f7f-75f856af5ecd.sql ---
-- Drop widget-related tables and references
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS default_widget_id;
DROP TABLE IF EXISTS public.task_widgets CASCADE;
DROP TABLE IF EXISTS public.widget_tokens CASCADE;
-- Update default landing if it pointed to widget
UPDATE public.user_settings SET default_landing = 'today' WHERE default_landing = 'widget';

-- --- Migration: 20260429022432_7558000b-74be-4967-bfc8-accfb3f7d986.sql ---
ALTER TYPE public.task_priority ADD VALUE IF NOT EXISTS 'urgent' BEFORE 'high';

-- --- Migration: 20260430043937_624d0e4b-4d3c-46af-b961-2419908e662c.sql ---
-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) has_role function (SECURITY DEFINER, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4) is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- 5) Policies on user_roles
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6) Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7) Auto-assign admin to first user, otherwise 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 8) Backfill: assign 'admin' to the earliest existing user, 'user' to the rest
INSERT INTO public.user_roles (user_id, role)
SELECT id,
  CASE WHEN id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
       THEN 'admin'::public.app_role
       ELSE 'user'::public.app_role END
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 9) Admin stats view (counts per table) — secured via SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.admin_user_list()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  task_count bigint,
  note_count bigint,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    p.display_name,
    p.avatar_url,
    u.created_at,
    u.last_sign_in_at,
    (SELECT COUNT(*) FROM public.tasks t WHERE t.user_id = u.id) AS task_count,
    (SELECT COUNT(*) FROM public.notes n WHERE n.user_id = u.id) AS note_count,
    public.has_role(u.id, 'admin') AS is_admin
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- --- Migration: 20260504085224_3c71c846-9e27-4803-805c-7dd0b8d955fb.sql ---
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_avoidance BOOLEAN NOT NULL DEFAULT false;

-- --- Migration: 20260505045006_34917fef-4e9e-43a4-a714-d6f810d0f2a7.sql ---
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS goal_id uuid;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS goal_id uuid;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily';
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS target_per_week smallint NOT NULL DEFAULT 7;

CREATE INDEX IF NOT EXISTS idx_notes_goal_id ON public.notes(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folders_goal_id ON public.folders(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_date) WHERE completed = false;

-- --- Migration: 20260505054106_d3796b4b-0605-4f96-8749-e3db0471ce71.sql ---
-- Lock down internal SECURITY DEFINER helpers from public API exposure.
-- These are used either as triggers or inside RLS policies; they should
-- not be invokable directly through PostgREST by anon or authenticated users.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
-- admin_user_list checks is_admin internally; restrict to authenticated only.
REVOKE EXECUTE ON FUNCTION public.admin_user_list() FROM anon, public;

-- --- Migration: 20260505054128_cd11a726-2479-415a-acf5-43c8cdd8b5bc.sql ---
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_list() FROM authenticated;

-- --- Migration: 20260505054151_ec37b62b-0bed-4ded-b8b4-1c59d3f5e15d.sql ---
GRANT EXECUTE ON FUNCTION public.admin_user_list() TO authenticated;

-- --- Migration: 20260507153418_4deff8a6-f1a6-4321-9c76-567ef38b8c91.sql ---
ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS note text;

-- --- Migration: 20260509010055_19976346-d517-4a9c-8e86-6c5a51ad4209.sql ---

-- Permission enum
CREATE TYPE public.share_permission AS ENUM ('view', 'comment', 'edit');
CREATE TYPE public.share_resource_type AS ENUM ('task', 'note', 'folder');

-- Shares table
CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recipient_id uuid,
  recipient_email text NOT NULL,
  resource_type public.share_resource_type NOT NULL,
  resource_id uuid NOT NULL,
  permission public.share_permission NOT NULL DEFAULT 'view',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id, recipient_email)
);

CREATE INDEX idx_shares_recipient ON public.shares(recipient_id);
CREATE INDEX idx_shares_recipient_email ON public.shares(lower(recipient_email));
CREATE INDEX idx_shares_resource ON public.shares(resource_type, resource_id);
CREATE INDEX idx_shares_owner ON public.shares(owner_id);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage shares" ON public.shares
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Recipients view their shares" ON public.shares
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE TRIGGER update_shares_updated_at
BEFORE UPDATE ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: does user have access to a resource (direct share or via parent folder)?
CREATE OR REPLACE FUNCTION public.has_share_access(
  _user_id uuid,
  _resource_type public.share_resource_type,
  _resource_id uuid,
  _min_permission public.share_permission DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH levels AS (
    SELECT CASE _min_permission
      WHEN 'view' THEN 1
      WHEN 'comment' THEN 2
      WHEN 'edit' THEN 3
    END AS min_lvl
  )
  SELECT EXISTS (
    -- Direct share on this resource
    SELECT 1 FROM public.shares s, levels
    WHERE s.recipient_id = _user_id
      AND s.resource_type = _resource_type
      AND s.resource_id = _resource_id
      AND CASE s.permission WHEN 'view' THEN 1 WHEN 'comment' THEN 2 WHEN 'edit' THEN 3 END >= levels.min_lvl
    UNION ALL
    -- Cascading: task/note inside a shared folder
    SELECT 1 FROM public.shares s, levels
    WHERE s.recipient_id = _user_id
      AND s.resource_type = 'folder'
      AND CASE s.permission WHEN 'view' THEN 1 WHEN 'comment' THEN 2 WHEN 'edit' THEN 3 END >= levels.min_lvl
      AND (
        (_resource_type = 'task' AND s.resource_id = (SELECT folder_id FROM public.tasks WHERE id = _resource_id))
        OR
        (_resource_type = 'note' AND s.resource_id = (SELECT folder_id FROM public.notes WHERE id = _resource_id))
      )
  );
$$;

-- Extend RLS on tasks
CREATE POLICY "Recipients view shared tasks" ON public.tasks
  FOR SELECT USING (public.has_share_access(auth.uid(), 'task', id, 'view'));

CREATE POLICY "Recipients with comment can update shared tasks" ON public.tasks
  FOR UPDATE USING (public.has_share_access(auth.uid(), 'task', id, 'comment'));

-- Extend RLS on notes
CREATE POLICY "Recipients view shared notes" ON public.notes
  FOR SELECT USING (public.has_share_access(auth.uid(), 'note', id, 'view'));

CREATE POLICY "Recipients with edit can update shared notes" ON public.notes
  FOR UPDATE USING (public.has_share_access(auth.uid(), 'note', id, 'edit'));

-- Extend RLS on folders
CREATE POLICY "Recipients view shared folders" ON public.folders
  FOR SELECT USING (public.has_share_access(auth.uid(), 'folder', id, 'view'));

-- Auto-link pending shares when a user signs up with matching email
CREATE OR REPLACE FUNCTION public.link_shares_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shares
  SET recipient_id = NEW.id,
      accepted_at = COALESCE(accepted_at, now())
  WHERE recipient_id IS NULL
    AND lower(recipient_email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_link_shares
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_shares_on_signup();


-- --- Migration: 20260509010117_3813e1bd-a051-4d0d-86d0-c8bb2a001db5.sql ---

REVOKE EXECUTE ON FUNCTION public.has_share_access(uuid, public.share_resource_type, uuid, public.share_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_share_access(uuid, public.share_resource_type, uuid, public.share_permission) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_shares_on_signup() FROM PUBLIC, anon, authenticated;


-- --- Migration: 20260509070722_64264e3b-a400-4a7d-ae3f-d03064c05845.sql ---

-- Milestones
CREATE TABLE public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goal_milestones" ON public.goal_milestones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_goal_milestones_goal ON public.goal_milestones(goal_id);
CREATE TRIGGER trg_goal_milestones_updated
  BEFORE UPDATE ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Key Results (OKR)
CREATE TABLE public.goal_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  unit TEXT,
  start_value NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goal_key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goal_key_results" ON public.goal_key_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_goal_key_results_goal ON public.goal_key_results(goal_id);
CREATE TRIGGER trg_goal_key_results_updated
  BEFORE UPDATE ON public.goal_key_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link habits to goals
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS goal_id UUID;
CREATE INDEX IF NOT EXISTS idx_habits_goal ON public.habits(goal_id);


-- --- Migration: 20260509072057_9e51dc85-edd3-4708-8fe8-7dc1b82b36ea.sql ---
-- Remove Goals feature: drop dependent columns and tables
ALTER TABLE public.tasks DROP COLUMN IF EXISTS goal_id;
ALTER TABLE public.notes DROP COLUMN IF EXISTS goal_id;
ALTER TABLE public.folders DROP COLUMN IF EXISTS goal_id;
ALTER TABLE public.habits DROP COLUMN IF EXISTS goal_id;
DROP TABLE IF EXISTS public.goal_key_results CASCADE;
DROP TABLE IF EXISTS public.goal_milestones CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;

-- --- Migration: 20260509112450_28ebc821-3f57-4064-902f-669ff64ad6b3.sql ---

CREATE TABLE public.cycle_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#EC4899',
  is_self boolean NOT NULL DEFAULT true,
  avg_cycle_length smallint NOT NULL DEFAULT 28,
  avg_period_length smallint NOT NULL DEFAULT 5,
  luteal_length smallint NOT NULL DEFAULT 14,
  notify_period boolean NOT NULL DEFAULT false,
  notify_ovulation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cycle_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cycle_profiles" ON public.cycle_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_cycle_profiles_updated BEFORE UPDATE ON public.cycle_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.cycle_profiles(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  event text,
  flow smallint,
  pain smallint,
  mood smallint,
  energy smallint,
  symptoms text[] DEFAULT '{}'::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, log_date)
);
CREATE INDEX idx_cycle_logs_profile_date ON public.cycle_logs(profile_id, log_date);
ALTER TABLE public.cycle_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cycle_logs" ON public.cycle_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_cycle_logs_updated BEFORE UPDATE ON public.cycle_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS cycle_overlay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_cycle_profile_id uuid;


-- --- Migration: 20260524073139_e9358aa0-d872-4fbd-a123-16517cd6ae27.sql ---
-- Revoke EXECUTE on SECURITY DEFINER trigger/internal functions that should
-- never be callable by signed-in users via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_shares_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- --- Migration: 20260531131805_2c939e46-6883-4bd5-a7ba-401ade88d956.sql ---

-- Revoke EXECUTE from public/anon/authenticated on internal trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_shares_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;


-- --- Migration: 20260603015236_d57ad549-9f1c-429a-8802-b25972b80c99.sql ---
-- Add time-bucket categorization to tasks
-- bucket_kind: 'day' | 'week' | 'month' | 'quarter' | 'year' (calendar-system agnostic; UI maps to Jalali or Gregorian)
-- bucket_calendar: 'jalali' | 'gregorian' (so a "month" anchor is unambiguous)
-- bucket_anchor: ISO date (yyyy-mm-dd) representing the start of the bucket period in the chosen calendar.
--   For day: that exact day. For week: first day of that week. For month/quarter/year: first day in that calendar system.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS bucket_kind text,
  ADD COLUMN IF NOT EXISTS bucket_calendar text,
  ADD COLUMN IF NOT EXISTS bucket_anchor date;

CREATE INDEX IF NOT EXISTS tasks_bucket_lookup_idx
  ON public.tasks (user_id, bucket_kind, bucket_calendar, bucket_anchor)
  WHERE bucket_kind IS NOT NULL;


-- --- Migration: 20260707140000_enable_realtime_sync.sql ---
-- Enable Supabase Realtime for the main tables used in ARSHNAZ
-- This allows live data sync between devices for logged-in users.

-- Make sure the realtime extension publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add core tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.habits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.habit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_step_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pomodoro_sessions;

-- Note: RLS policies still apply. Users only receive realtime events
-- for rows they are allowed to read.


-- --- Migration: 20260715000000_add_user_settings_show_daily_checkin.sql ---
-- Toggle to show/hide the daily check-in prompt card and auto-created task
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS show_daily_checkin BOOLEAN DEFAULT true;


-- --- Migration: 20260715053100_task_outcomes.sql ---
-- Conditional task outcomes: "if this task ends like X, create these follow-up tasks"

CREATE TABLE IF NOT EXISTS public.task_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users manage own task outcomes"
  ON public.task_outcomes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_outcomes_task ON public.task_outcomes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_outcomes_user ON public.task_outcomes(user_id);

CREATE OR REPLACE FUNCTION public.update_task_outcomes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_outcomes_updated ON public.task_outcomes;
CREATE TRIGGER trg_task_outcomes_updated
  BEFORE UPDATE ON public.task_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_task_outcomes_updated_at();

-- Log which outcome was chosen and which tasks were created from it
CREATE TABLE IF NOT EXISTS public.outcome_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  outcome_id UUID NOT NULL REFERENCES public.task_outcomes(id) ON DELETE CASCADE,
  created_task_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outcome_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users view own outcome executions"
  ON public.outcome_executions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_outcome_executions_task ON public.outcome_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_outcome_executions_user ON public.outcome_executions(user_id);

-- Back-fill: existing tasks with subtasks can optionally have an "auto" outcome later
-- (no data migration needed)


-- --- Migration: 20260715060000_task_defaults.sql ---
-- Add task default settings as a JSONB column on user_settings.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS task_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;


-- --- Migration: 20260715100000_professional_sharing.sql ---
-- Professional sharing: explicit accept/decline, permission helper, and subtask sharing

-- 1. Require accepted_at for access (with folder and parent-task cascade)
CREATE OR REPLACE FUNCTION public.has_share_access(
  _user_id uuid,
  _resource_type public.share_resource_type,
  _resource_id uuid,
  _min_permission public.share_permission DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE levels AS (
    SELECT CASE _min_permission
      WHEN 'view' THEN 1
      WHEN 'comment' THEN 2
      WHEN 'edit' THEN 3
    END AS min_lvl
  ),
  seed AS (
    SELECT _resource_id AS id, NULL::uuid AS folder_id, (SELECT parent_id FROM public.folders WHERE id = _resource_id) AS parent_id
    WHERE _resource_type = 'folder'
    UNION ALL
    SELECT
      _resource_id,
      CASE _resource_type
        WHEN 'task' THEN (SELECT folder_id FROM public.tasks WHERE id = _resource_id)
        WHEN 'note' THEN (SELECT folder_id FROM public.notes WHERE id = _resource_id)
        ELSE NULL
      END,
      CASE _resource_type
        WHEN 'task' THEN (SELECT parent_id FROM public.tasks WHERE id = _resource_id)
        ELSE NULL
      END
    WHERE _resource_type IN ('task', 'note')
  ),
  chain(id, folder_id, parent_id, depth) AS (
    SELECT id, folder_id, parent_id, 0 FROM seed
    UNION ALL
    -- Walk up parent tasks
    SELECT t.id, t.folder_id, t.parent_id, c.depth + 1
    FROM public.tasks t
    JOIN chain c ON t.id = c.parent_id
    WHERE c.depth < 10
    UNION ALL
    -- Walk up folder ancestors for any folder_id encountered
    SELECT f.id, f.parent_id, NULL::uuid, c.depth + 1
    FROM public.folders f
    JOIN chain c ON f.id = c.folder_id
    WHERE c.depth < 10
    UNION ALL
    -- Walk up folder ancestors using the parent_id field (for folder resources and folder rows)
    SELECT f.id, f.parent_id, NULL::uuid, c.depth + 1
    FROM public.folders f
    JOIN chain c ON f.id = c.parent_id
    WHERE c.depth < 10
  )
  SELECT EXISTS (
    SELECT 1 FROM public.shares s, levels, chain c
    WHERE s.recipient_id = _user_id
      AND s.accepted_at IS NOT NULL
      AND (
        -- Direct share on this resource or a parent task/folder
        (s.resource_type = _resource_type AND s.resource_id = c.id)
        -- Folder share covering any folder in the chain
        OR (s.resource_type = 'folder' AND s.resource_id = c.folder_id)
        -- Parent task share for task descendants
        OR (_resource_type = 'task' AND s.resource_type = 'task' AND s.resource_id = c.id AND c.depth > 0)
      )
      AND CASE s.permission WHEN 'view' THEN 1 WHEN 'comment' THEN 2 WHEN 'edit' THEN 3 END >= levels.min_lvl
  );
$$;

-- 2. Effective permission for a user on a resource ('owner' if they own it)
CREATE OR REPLACE FUNCTION public.get_effective_share_permission(
  _user_id uuid,
  _resource_type public.share_resource_type,
  _resource_id uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  -- owner?
  IF _resource_type = 'task' THEN
    SELECT user_id INTO owner_id FROM public.tasks WHERE id = _resource_id;
  ELSIF _resource_type = 'note' THEN
    SELECT user_id INTO owner_id FROM public.notes WHERE id = _resource_id;
  ELSIF _resource_type = 'folder' THEN
    SELECT user_id INTO owner_id FROM public.folders WHERE id = _resource_id;
  END IF;

  IF owner_id IS NOT NULL AND owner_id = _user_id THEN
    RETURN 'owner';
  END IF;

  -- Highest permission granted through direct share, folder share, or parent-task share
  IF public.has_share_access(_user_id, _resource_type, _resource_id, 'edit') THEN
    RETURN 'edit';
  END IF;
  IF public.has_share_access(_user_id, _resource_type, _resource_id, 'comment') THEN
    RETURN 'comment';
  END IF;
  IF public.has_share_access(_user_id, _resource_type, _resource_id, 'view') THEN
    RETURN 'view';
  END IF;

  RETURN NULL;
END;
$$;

-- 3. RPC helpers for accept / decline
CREATE OR REPLACE FUNCTION public.accept_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  UPDATE public.shares
  SET accepted_at = now(), recipient_id = coalesce(recipient_id, auth.uid())
  WHERE id = _share_id
    AND accepted_at IS NULL
    AND (
      recipient_id = auth.uid()
      OR lower(recipient_email) = _email
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_share(_share_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  DELETE FROM public.shares
  WHERE id = _share_id
    AND (
      recipient_id = auth.uid()
      OR lower(recipient_email) = _email
      OR owner_id = auth.uid()
    );
END;
$$;

-- 4. When a share is created, link it to an existing user by email but keep it pending
CREATE OR REPLACE FUNCTION public.link_share_recipient()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF NEW.recipient_id IS NULL THEN
    SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(NEW.recipient_email) LIMIT 1;
    IF uid IS NOT NULL THEN
      NEW.recipient_id := uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_share_recipient ON public.shares;
CREATE TRIGGER trg_link_share_recipient
BEFORE INSERT ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.link_share_recipient();

-- 5. New users no longer auto-accept; they still get linked to pending shares
CREATE OR REPLACE FUNCTION public.link_shares_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.shares
  SET recipient_id = NEW.id
  WHERE recipient_id IS NULL
    AND lower(recipient_email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

-- 6. Recipients can view shares (including pending) and owners can manage them
DROP POLICY IF EXISTS "Recipients view their shares" ON public.shares;
CREATE POLICY "Recipients view their shares" ON public.shares
  FOR SELECT USING (
    owner_id = auth.uid()
    OR recipient_id = auth.uid()
    OR lower(recipient_email) = lower((select email from auth.users where id = auth.uid()))
  );

DROP POLICY IF EXISTS "Owners manage shares" ON public.shares;
CREATE POLICY "Owners manage shares" ON public.shares
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 7. Subtasks inherit task share permission (view/comment)
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients view shared subtasks" ON public.subtasks;
CREATE POLICY "Recipients view shared subtasks" ON public.subtasks
  FOR SELECT USING (public.has_share_access(auth.uid(), 'task', task_id, 'view'));

DROP POLICY IF EXISTS "Recipients with comment can create subtasks" ON public.subtasks;
CREATE POLICY "Recipients with comment can create subtasks" ON public.subtasks
  FOR INSERT WITH CHECK (public.has_share_access(auth.uid(), 'task', task_id, 'comment'));

DROP POLICY IF EXISTS "Recipients with comment can update subtasks" ON public.subtasks;
CREATE POLICY "Recipients with comment can update subtasks" ON public.subtasks
  FOR UPDATE USING (public.has_share_access(auth.uid(), 'task', task_id, 'comment'));

-- 8. Enforce permission semantics at the DB level for tasks
--    comment: only completion status; edit: full update; owner: always allowed
CREATE OR REPLACE FUNCTION public.enforce_task_share_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  IF public.has_share_access(auth.uid(), 'task', NEW.id, 'edit') THEN
    RETURN NEW;
  END IF;
  IF public.has_share_access(auth.uid(), 'task', NEW.id, 'comment') THEN
    IF NEW.completed IS DISTINCT FROM OLD.completed OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'comment permission can only update completion';
  END IF;
  RAISE EXCEPTION 'no permission to update this task';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_share_update ON public.tasks;
CREATE TRIGGER trg_enforce_task_share_update
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_share_update();

-- 9. One-time link for any legacy shares created before this migration
UPDATE public.shares s
SET recipient_id = u.id
FROM auth.users u
WHERE s.recipient_id IS NULL
  AND lower(s.recipient_email) = lower(u.email);


-- --- Migration: 20260717000000_add_task_outcome_id.sql ---
-- Link outcome-created tasks back to their branch for grouping and display
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outcome_id UUID REFERENCES public.task_outcomes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_outcome_id ON public.tasks(outcome_id);


-- --- Migration: 20260727043143_c8118a7f-984a-437e-b2f9-b2ca84d139ed.sql ---
-- TickTick-style task features: Won't Do status, activities, templates, location.

-- 1. Allow tasks to be marked "won't do" using the existing status enum.
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'wont_do';

-- 2. Optional location metadata for tasks.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS location TEXT;

-- 3. Activity log for tasks (history of actions).
CREATE TABLE IF NOT EXISTS public.task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users manage own task activities" ON public.task_activities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_task ON public.task_activities(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_user ON public.task_activities(user_id);

-- 4. Task templates.
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'none',
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  due_offset_hours INT,
  recurrence public.recurrence_type NOT NULL DEFAULT 'none',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users manage own task templates" ON public.task_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_user ON public.task_templates(user_id);

CREATE OR REPLACE FUNCTION public.update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_templates_updated ON public.task_templates;
CREATE TRIGGER trg_task_templates_updated
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_task_templates_updated_at();

-- 5. Backfill: tasks that are completed=true but have no status should be 'done'.
UPDATE public.tasks SET status = 'done' WHERE completed = true AND status IS NULL;


-- --- Migration: 20260803022656_b08cb787-ce8d-4bfe-9f19-ef70d62526b6.sql ---
CREATE TABLE IF NOT EXISTS public.task_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_outcomes TO authenticated;
GRANT ALL ON public.task_outcomes TO service_role;
ALTER TABLE public.task_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own task outcomes" ON public.task_outcomes;
CREATE POLICY "Users manage own task outcomes"
  ON public.task_outcomes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_outcomes_task ON public.task_outcomes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_outcomes_user ON public.task_outcomes(user_id);

DROP TRIGGER IF EXISTS trg_task_outcomes_updated ON public.task_outcomes;
CREATE TRIGGER trg_task_outcomes_updated
  BEFORE UPDATE ON public.task_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.outcome_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  outcome_id UUID NOT NULL REFERENCES public.task_outcomes(id) ON DELETE CASCADE,
  created_task_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcome_executions TO authenticated;
GRANT ALL ON public.outcome_executions TO service_role;
ALTER TABLE public.outcome_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own outcome executions" ON public.outcome_executions;
CREATE POLICY "Users view own outcome executions"
  ON public.outcome_executions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_outcome_executions_task ON public.outcome_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_outcome_executions_user ON public.outcome_executions(user_id);

-- --- Migration: 20260803022746_dea59a95-f987-4a98-b9c4-2ff9826302ce.sql ---
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'none',
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  due_offset_hours INTEGER,
  recurrence public.recurrence_type NOT NULL DEFAULT 'none',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own task templates" ON public.task_templates;
CREATE POLICY "Users manage own task templates" ON public.task_templates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_task_templates_updated ON public.task_templates;
CREATE TRIGGER trg_task_templates_updated BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_activities TO authenticated;
GRANT ALL ON public.task_activities TO service_role;
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own task activities" ON public.task_activities;
CREATE POLICY "Users manage own task activities" ON public.task_activities
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_task_activities_task ON public.task_activities(task_id);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS task_defaults JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_effective_share_permission(
  _user_id UUID,
  _resource_type public.share_resource_type,
  _resource_id UUID
)
RETURNS public.share_permission
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission
  FROM public.shares
  WHERE recipient_id = _user_id
    AND resource_type = _resource_type
    AND resource_id = _resource_id
    AND accepted_at IS NOT NULL
  ORDER BY CASE permission WHEN 'edit' THEN 3 WHEN 'comment' THEN 2 ELSE 1 END DESC
  LIMIT 1
$$;

-- --- Migration: 20260803022815_932ddea8-18b8-423f-afbc-df3448c3fae3.sql ---
REVOKE ALL ON FUNCTION public.get_effective_share_permission(uuid, public.share_resource_type, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_share_permission(uuid, public.share_resource_type, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_share(_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shares
  SET recipient_id = auth.uid(), accepted_at = now(), updated_at = now()
  WHERE id = _share_id
    AND (recipient_id = auth.uid()
         OR lower(recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.accept_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_share(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_share(_share_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.shares
  WHERE id = _share_id
    AND (recipient_id = auth.uid()
         OR lower(recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.decline_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_share(uuid) TO authenticated;

