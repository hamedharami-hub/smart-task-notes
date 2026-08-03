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
