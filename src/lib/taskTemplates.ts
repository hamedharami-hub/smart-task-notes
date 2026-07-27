import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskTemplate } from "@/lib/taskTypes";
import { addHours } from "date-fns";

export async function saveTaskTemplate(userId: string, task: Task, title?: string): Promise<TaskTemplate | null> {
  const { data, error } = await supabase
    .from("task_templates")
    .insert({
      user_id: userId,
      title: title?.trim() || task.title,
      description: task.description,
      priority: task.priority,
      folder_id: task.folder_id,
      recurrence: task.recurrence,
      payload: {
        parent_id: task.parent_id,
        estimated_minutes: task.estimated_minutes,
        is_avoidance: task.is_avoidance,
        location: task.location,
      },
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskTemplate | null;
}

export async function listTaskTemplates(userId: string): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as TaskTemplate[];
}

export async function deleteTaskTemplate(userId: string, id: string) {
  const { error } = await supabase.from("task_templates").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export function buildTaskFromTemplate(template: TaskTemplate): Partial<Task> {
  const due = template.due_offset_hours
    ? addHours(new Date(), template.due_offset_hours).toISOString()
    : null;
  return {
    title: template.title,
    description: template.description || null,
    priority: template.priority,
    folder_id: template.folder_id || null,
    due_date: due,
    recurrence: template.recurrence || "none",
    ...(template.payload || {}),
  };
}

export async function createTaskFromTemplate(
  userId: string,
  template: TaskTemplate,
  overrides: Partial<Task> = {},
): Promise<Task | null> {
  const base = buildTaskFromTemplate(template);
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, ...base, ...overrides })
    .select()
    .single();
  if (error) throw error;
  return data as Task | null;
}
