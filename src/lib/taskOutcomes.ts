import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskOutcome, OutcomeAction, OutcomeExecution } from "@/lib/taskTypes";
import { addHours } from "date-fns";

function toOutcome(row: unknown): TaskOutcome {
  const r = row as { id: string; task_id: string; label: string; color?: string | null; icon?: string | null; position: number; actions?: unknown; created_at: string; updated_at: string };
  return {
    ...r,
    actions: (r.actions || []) as OutcomeAction[],
  };
}

export async function listTaskOutcomes(taskId: string): Promise<TaskOutcome[]> {
  const { data, error } = await supabase
    .from("task_outcomes")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data || []) as unknown[]).map(toOutcome);
}

export async function saveTaskOutcome(outcome: Partial<TaskOutcome>): Promise<TaskOutcome> {
  if (outcome.id) {
    const { id: _id, user_id: _u, ...rest } = outcome;
    const { data, error } = await supabase
      .from("task_outcomes")
      .update(rest as never)
      .eq("id", outcome.id)
      .select()
      .single();
    if (error) throw error;
    return toOutcome(data as unknown);
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { id: _ignore, ...rest } = outcome;
  const payload = { ...rest, user_id: uid };
  const { data, error } = await supabase.from("task_outcomes").insert(payload as never).select().single();
  if (error) throw error;
  return toOutcome(data as unknown);
}

export async function deleteTaskOutcome(id: string) {
  const { error } = await supabase.from("task_outcomes").delete().eq("id", id);
  if (error) throw error;
}

export async function executeTaskOutcome(
  outcome: TaskOutcome,
  userId: string,
  parentTask: Task,
): Promise<{ taskIds: string[]; execution: OutcomeExecution }> {
  const createdIds: string[] = [];
  for (const action of outcome.actions || []) {
    const due = action.due_offset_hours ? addHours(new Date(), action.due_offset_hours).toISOString() : null;
    const insert: Record<string, unknown> = {
      user_id: userId,
      title: action.title,
      description: action.description || null,
      priority: action.priority || "none",
      folder_id: action.folder_id ?? parentTask.folder_id,
      due_date: due,
      status: "todo",
      completed: false,
    };
    const { data, error } = await supabase.from("tasks").insert(insert as never).select("id").single();
    if (error) throw error;
    const createdId = (data as unknown as { id?: string } | null)?.id;
    if (createdId) {
      createdIds.push(createdId);
      if (action.tag_ids?.length) {
        await supabase.from("task_tags").insert(
          action.tag_ids.map((tagId) => ({ user_id: userId, task_id: createdId, tag_id: tagId })) as never,
        );
      }
    }
  }

  const executionInsert: Record<string, unknown> = {
    user_id: userId,
    task_id: parentTask.id,
    outcome_id: outcome.id,
    created_task_ids: createdIds,
  };
  const { data, error } = await supabase
    .from("outcome_executions")
    .insert(executionInsert as never)
    .select()
    .single();
  if (error) throw error;

  const execution = toExecution({ ...(data as unknown as object), created_task_ids: createdIds } as unknown);
  return { taskIds: createdIds, execution };
}

function toExecution(row: unknown): OutcomeExecution {
  const r = row as { id: string; user_id?: string; task_id: string; outcome_id: string; created_task_ids?: string[]; created_at: string };
  return { ...r, created_task_ids: r.created_task_ids || [] };
}

export async function listOutcomeExecutions(taskId: string): Promise<OutcomeExecution[]> {
  const { data, error } = await supabase
    .from("outcome_executions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown[]).map(toExecution);
}
