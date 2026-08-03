import { supabase } from "@/integrations/supabase/client";
import type { TaskActivity } from "@/lib/taskTypes";

export async function logTaskActivity(
  taskId: string,
  userId: string,
  action: string,
  payload: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("task_activities")
    .insert({ task_id: taskId, user_id: userId, action, payload } as never);
  if (error) console.error("logTaskActivity", error);
}

export async function listTaskActivities(taskId: string) {
  const { data, error } = await supabase
    .from("task_activities")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as unknown as TaskActivity[];
}
