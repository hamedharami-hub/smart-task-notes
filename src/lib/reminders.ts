// Reminders engine — Web Notifications + auto daily task creation
import { supabase } from "@/integrations/supabase/client";

export type TaskDefaults = {
  default_date?: "none" | "today" | "tomorrow" | "next7" | null;
  default_reminder?: "none" | "ontime" | "5min" | "15min" | "30min" | "1hour" | "2hours" | "1day" | "2days" | null;
  default_priority?: "none" | "low" | "medium" | "high" | null;
  default_tag_id?: string | null;
  default_folder_id?: string | null;
  default_add_to?: "top" | "bottom";
  overdue_position?: "top" | "bottom";
};

export type UserSettings = {
  user_id: string;
  checkin_reminder_enabled: boolean;
  checkin_reminder_time: string;
  notifications_enabled: boolean;
  micro_prompt_enabled: boolean;
  theme: string;
  auto_create_daily_tasks: boolean;
  font_size: "small" | "medium" | "large" | "xlarge";
  ui_scale: number;
  task_card_layout: "compact" | "comfortable";
  default_landing: "today" | "home" | "last";
  task_defaults: TaskDefaults;
};

const LAST_NOTIFY_KEY = "reminder_last_fired_v1"; // {sleep:"YYYY-MM-DD", checkin:"YYYY-MM-DD"}
const LAST_TASK_KEY = "reminder_last_task_v1"; // "YYYY-MM-DD"

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseHM(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h, m: m || 0 };
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

function fire(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag, icon: "/icon-192.png" });
  } catch {
    /* ignore */
  }
}

const FIRED_TASKS_KEY = "reminder_fired_tasks_v1";

function playBeep() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch { /* ignore */ }
}

export async function checkTaskReminders(userId: string, s: UserSettings) {
  if (!s.notifications_enabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("tasks")
    .select("id,title,reminder_at")
    .eq("user_id", userId)
    .eq("completed", false)
    .not("reminder_at", "is", null)
    .lte("reminder_at", nowIso)
    .gte("reminder_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  if (!data || data.length === 0) return;
  const fired: Record<string, string> = JSON.parse(localStorage.getItem(FIRED_TASKS_KEY) || "{}");
  let played = false;
  for (const t of data as any[]) {
    const key = `${t.id}:${t.reminder_at}`;
    if (fired[key]) continue;
    fire("⏰ یادآور تسک", t.title, key);
    if (!played) { playBeep(); played = true; }
    fired[key] = nowIso;
  }
  // GC: keep only entries from last 7 days
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  for (const k of Object.keys(fired)) {
    if (new Date(fired[k]).getTime() < cutoff) delete fired[k];
  }
  localStorage.setItem(FIRED_TASKS_KEY, JSON.stringify(fired));
}


export function checkAndFireReminders(s: UserSettings) {
  if (!s.notifications_enabled) return;
  const now = new Date();
  const today = todayKey();
  const stored = JSON.parse(localStorage.getItem(LAST_NOTIFY_KEY) || "{}");

  const tryFire = (kind: "sleep" | "checkin", enabled: boolean, time: string, title: string, body: string) => {
    if (!enabled) return;
    if (stored[kind] === today) return;
    const { h, m } = parseHM(time);
    if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
      fire(title, body, `${kind}-${today}`);
      stored[kind] = today;
    }
  };

  tryFire("checkin", s.checkin_reminder_enabled, s.checkin_reminder_time,
    "📝 چک‌این روزانه", "حال امروزت چطور بود؟");

  localStorage.setItem(LAST_NOTIFY_KEY, JSON.stringify(stored));
}

export async function ensureDailyTasks(userId: string, s: UserSettings) {
  if (!s.auto_create_daily_tasks) return;
  const today = todayKey();
  if (localStorage.getItem(LAST_TASK_KEY) === today) return;

  const dueIso = new Date().toISOString();
  const items: { title: string; description: string }[] = [];
  if (s.checkin_reminder_enabled) items.push({
    title: "چک‌این روزانه 📝",
    description: "خلق، انرژی، تمرکز، استرس را ثبت کن. روی این تسک بزن تا مستقیم به صفحه چک‌این بری.",
  });

  if (items.length === 0) {
    localStorage.setItem(LAST_TASK_KEY, today);
    return;
  }

  // Avoid duplicates: check for tasks today with these titles
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { data: existing } = await supabase
    .from("tasks")
    .select("title")
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  const existingTitles = new Set((existing || []).map((t: any) => t.title));

  const toInsert = items
    .filter((i) => !existingTitles.has(i.title))
    .map((i) => ({
      user_id: userId,
      title: i.title,
      description: i.description,
      due_date: dueIso,
      priority: "medium" as const,
      recurrence: "daily" as const,
    }));

  if (toInsert.length > 0) {
    await supabase.from("tasks").insert(toInsert);
  }
  localStorage.setItem(LAST_TASK_KEY, today);
}

const settingsCache = new Map<string, Promise<UserSettings | null>>();
export async function loadSettings(userId: string): Promise<UserSettings | null> {
  const cached = settingsCache.get(userId);
  if (cached) return cached;
  const p = (async () => {
    const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
    if (data) return { task_defaults: {}, ...(data as UserSettings) } as UserSettings;
    const { data: created } = await supabase
      .from("user_settings")
      .insert({ user_id: userId })
      .select()
      .maybeSingle();
    return (created as UserSettings) || null;
  })();
  settingsCache.set(userId, p);
  // Allow refresh after 30s
  setTimeout(() => settingsCache.delete(userId), 30_000);
  return p;
}

export async function saveSettings(userId: string, patch: Partial<UserSettings>) {
  settingsCache.delete(userId);
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}
