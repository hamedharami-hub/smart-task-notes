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
