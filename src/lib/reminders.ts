// Reminders engine — Web Notifications + auto daily task creation
import { supabase } from "@/integrations/supabase/client";
import { cacheGet, cacheSet, enqueueOp } from "@/lib/offlineQueue";
import { fireNotification, hasNotificationPermission } from "@/lib/notify";
export { ensureNotificationPermission } from "@/lib/notify";

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
  show_daily_checkin: boolean;
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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseHM(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h, m: m || 0 };
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
  if (!(await hasNotificationPermission())) return;
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
    fireNotification("⏰ یادآور تسک", t.title, key);
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


export async function checkAndFireReminders(s: UserSettings) {
  if (!s.notifications_enabled) return;
  if (!(await hasNotificationPermission())) return;
  const now = new Date();
  const today = todayKey();
  const stored = JSON.parse(localStorage.getItem(LAST_NOTIFY_KEY) || "{}");

  const tryFire = (kind: "sleep" | "checkin", enabled: boolean, time: string, title: string, body: string) => {
    if (!enabled) return;
    if (stored[kind] === today) return;
    const { h, m } = parseHM(time);
    if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
      fireNotification(title, body, `${kind}-${today}`);
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
  if (s.checkin_reminder_enabled && s.show_daily_checkin !== false) items.push({
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

const SETTINGS_CACHE_KEY = (userId: string) => `settings:${userId}`;
const DEFAULT_SETTINGS: UserSettings = {
  user_id: "",
  show_daily_checkin: true,
  checkin_reminder_enabled: true,
  checkin_reminder_time: "20:00",
  notifications_enabled: false,
  micro_prompt_enabled: false,
  theme: "system",
  auto_create_daily_tasks: false,
  font_size: "medium",
  ui_scale: 1,
  task_card_layout: "compact",
  default_landing: "today",
  task_defaults: {},
};

const settingsCache = new Map<string, Promise<UserSettings | null>>();
export async function loadSettings(userId: string): Promise<UserSettings | null> {
  const cached = settingsCache.get(userId);
  if (cached) return cached;
  const p = (async () => {
    const cachedValue = await cacheGet<UserSettings>(SETTINGS_CACHE_KEY(userId));

    // If offline, return cached or default immediately so navigation isn't blocked
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return cachedValue ? { ...DEFAULT_SETTINGS, ...cachedValue, user_id: userId } : { ...DEFAULT_SETTINGS, user_id: userId };
    }

    try {
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
      if (data) {
        const settings = { ...DEFAULT_SETTINGS, task_defaults: data.task_defaults || DEFAULT_SETTINGS.task_defaults, ...(data as unknown as Partial<UserSettings>), user_id: userId } as UserSettings;
        await cacheSet(SETTINGS_CACHE_KEY(userId), settings);
        return settings;
      }
      const { data: created } = await supabase
        .from("user_settings")
        .insert({ user_id: userId })
        .select()
        .maybeSingle();
      const settings = { ...DEFAULT_SETTINGS, ...(created as unknown as Partial<UserSettings>), user_id: userId };
      await cacheSet(SETTINGS_CACHE_KEY(userId), settings);
      return settings;
    } catch {
      return cachedValue ? { ...DEFAULT_SETTINGS, ...cachedValue, user_id: userId } : { ...DEFAULT_SETTINGS, user_id: userId };
    }
  })();
  settingsCache.set(userId, p);
  setTimeout(() => settingsCache.delete(userId), 30_000);
  return p;
}

export async function saveSettings(userId: string, patch: Partial<UserSettings>) {
  settingsCache.delete(userId);
  const current = (await cacheGet<UserSettings>(SETTINGS_CACHE_KEY(userId))) || { ...DEFAULT_SETTINGS, user_id: userId };
  const next = { ...current, ...patch, user_id: userId };
  await cacheSet(SETTINGS_CACHE_KEY(userId), next);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueOp({
      table: "user_settings",
      op: "upsert",
      payload: { user_id: userId, ...patch },
      upsertOptions: { onConflict: "user_id" },
    });
    return;
  }
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, ...patch } as never, { onConflict: "user_id" });
  if (error) throw error;
}
