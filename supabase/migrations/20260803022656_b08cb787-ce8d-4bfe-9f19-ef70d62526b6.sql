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