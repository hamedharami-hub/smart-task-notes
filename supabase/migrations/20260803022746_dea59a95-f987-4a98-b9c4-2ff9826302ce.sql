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