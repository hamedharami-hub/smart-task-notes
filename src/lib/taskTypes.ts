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
  outcome_id?: string | null;
  pinned: boolean;
  start_at: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  is_avoidance?: boolean;
  location?: string | null;
  bucket_kind?: "day" | "week" | "month" | "quarter" | "year" | null;
  bucket_calendar?: "jalali" | "gregorian" | null;
  bucket_anchor?: string | null;
  // transient UI state for deleted-task grace period
  _graceUntil?: number;
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

export type OutcomeAction = {
  title: string;
  description?: string | null;
  priority?: Priority;
  folder_id?: string | null;
  due_offset_hours?: number | null;
  tag_ids?: string[];
};

export type TaskOutcome = {
  id: string;
  user_id?: string;
  task_id: string;
  label: string;
  color?: string | null;
  icon?: string | null;
  position: number;
  actions: OutcomeAction[];
  created_at: string;
  updated_at: string;
};

export type OutcomeExecution = {
  id: string;
  user_id?: string;
  task_id: string;
  outcome_id: string;
  created_task_ids: string[];
  created_at: string;
};

export type ConfirmState =
  | { kind: "task" | "note" | "subtask-row"; id: string; title: string; onConfirm: () => Promise<void> }
  | null;
