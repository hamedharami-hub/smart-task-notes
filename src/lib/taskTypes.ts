import type { Priority } from "@/lib/priority";
import type { RecurrenceRule } from "@/lib/recurrence";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  completed: boolean;
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
  bucket_kind?: "day" | "week" | "month" | "quarter" | "year" | null;
  bucket_calendar?: "jalali" | "gregorian" | null;
  bucket_anchor?: string | null;
};

export type TaskNote = { id: string; title: string; content: string };

export type ConfirmState =
  | { kind: "task" | "note" | "subtask-row"; id: string; title: string; onConfirm: () => Promise<void> }
  | null;
