-- Link outcome-created tasks back to their branch for grouping and display
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS outcome_id UUID REFERENCES public.task_outcomes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_outcome_id ON public.tasks(outcome_id);
