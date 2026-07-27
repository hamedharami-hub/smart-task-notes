import type { Priority } from "@/lib/priority";
import type { RecurrenceRule } from "@/lib/recurrence";

export type TaskStatus = "todo" | "in_progress" | "done" | "wont_do";

export type Task = {
  id: string;
  user_id?: string;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  completed: boolean;
  status: TaskStatus;
  folder_id: string | null;
  reminder_at: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrence_rule: RecurrenceRule | null;
  parent_id: string | null;
  pinned: boolean;
  start_at: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  is_avoidance?: boolean;
  location?: string | null;
  bucket_kind?: "day" | "week" | "month" | "quarter" | "year" | null;
  bucket_calendar?: "jalali" | "gregorian" | null;
  bucket_anchor?: string | null;
};

export type TaskTemplate = {
  id: string;
  user_id?: string;
  title: string;
  description?: string | null;
  priority: Priority;
  folder_id?: string | null;
  due_offset_hours?: number | null;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  payload?: Record<string, unknown>;
};

export type TaskActivity = {
  id: string;
  user_id?: string;
  task_id: string;
  action: string;
  payload?: Record<string, unknown>;
  created_at: string;
};

export type TaskNote = { id: string; title: string; content: string };

export type ConfirmState =
  | { kind: "task" | "note" | "subtask-row"; id: string; title: string; onConfirm: () => Promise<void> }
  | null;
