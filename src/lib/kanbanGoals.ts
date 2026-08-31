export type TimeHorizon = "yearly" | "quarterly" | "monthly" | "weekly" | "none";
export type GoalPriority = "urgent" | "high" | "medium" | "low" | "none";

export interface GoalKanban {
  id: string;
  title: string;
  description?: string;
  parentId: string | null;
  timeHorizon: TimeHorizon;
  priority: GoalPriority;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export const TIME_HORIZONS: { id: TimeHorizon; labelFa: string; labelEn: string; icon: string; days: number }[] = [
  { id: "yearly", labelFa: "سالانه", labelEn: "Yearly", icon: "🗓️", days: 365 },
  { id: "quarterly", labelFa: "فصلی", labelEn: "Quarterly", icon: "🍂", days: 90 },
  { id: "monthly", labelFa: "ماهانه", labelEn: "Monthly", icon: "🌙", days: 30 },
  { id: "weekly", labelFa: "هفتگی", labelEn: "Weekly", icon: "⚡", days: 7 },
  { id: "none", labelFa: "بدون بازه", labelEn: "No Horizon", icon: "♾️", days: 0 },
];

export const GOAL_PRIORITIES: { id: GoalPriority; labelFa: string; labelEn: string; color: string; badge: string }[] = [
  { id: "urgent", labelFa: "P1 - حیاتی", labelEn: "P1 - Urgent", color: "#ef4444", badge: "🔴" },
  { id: "high", labelFa: "P2 - بالا", labelEn: "P2 - High", color: "#f97316", badge: "🟠" },
  { id: "medium", labelFa: "P3 - متوسط", labelEn: "P3 - Medium", color: "#eab308", badge: "🟡" },
  { id: "low", labelFa: "P4 - کم", labelEn: "P4 - Low", color: "#3b82f6", badge: "🔵" },
  { id: "none", labelFa: "عادی", labelEn: "None", color: "#64748b", badge: "⚪" },
];

const GOALS_STORAGE_KEY = "arshnaz_kanban_goals_v3";

export const INITIAL_GOALS: GoalKanban[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    title: "آموزش و خودآگاهی",
    description: "توسعه فردی، یادگیری مهارت‌های جدید و رشد ذهن",
    parentId: null,
    timeHorizon: "yearly",
    priority: "high",
    color: "#3b82f6",
    icon: "📚",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    title: "زبان و مکالمه",
    description: "تمرین روزمره زبان، تقویت اسپیکینگ و دایره واژگان",
    parentId: "a0000000-0000-4000-8000-000000000001",
    timeHorizon: "monthly",
    priority: "urgent",
    color: "#06b6d4",
    icon: "🗣️",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    title: "خواندن و آموزش با هوش مصنوعی",
    description: "مطالعه کتاب‌های تخصصی و تمرین مکالمه هوش مصنوعی",
    parentId: "a0000000-0000-4000-8000-000000000001",
    timeHorizon: "weekly",
    priority: "medium",
    color: "#8b5cf6",
    icon: "🤖",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    title: "کسب‌وکار و پروژه‌ها",
    description: "توسعه محصول، ارتقای اپلیکیشن و اهداف مالی",
    parentId: null,
    timeHorizon: "yearly",
    priority: "urgent",
    color: "#10b981",
    icon: "💼",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    title: "سلامت و آرامش ذهن",
    description: "ورزش، تمرین تنفس، خواب منظم و چک‌این روزانه",
    parentId: null,
    timeHorizon: "quarterly",
    priority: "high",
    color: "#ec4899",
    icon: "🫀",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function sanitizeGoalsUUIDs(goals: GoalKanban[]): GoalKanban[] {
  const idMap = new Map<string, string>();

  // Map invalid UUIDs to valid UUIDs
  goals.forEach((g) => {
    if (!isValidUUID(g.id)) {
      idMap.set(g.id, generateUUID());
    }
  });

  if (idMap.size === 0) return goals;

  return goals.map((g) => ({
    ...g,
    id: idMap.get(g.id) || g.id,
    parentId: g.parentId ? idMap.get(g.parentId) || g.parentId : null,
  }));
}

export function getKanbanGoals(folderId?: string | null, userId?: string): GoalKanban[] {
  const baseKey = folderId ? `${GOALS_STORAGE_KEY}_folder_${folderId}` : GOALS_STORAGE_KEY;
  const key = userId ? `${baseKey}_${userId}` : baseKey;
  try {
    let raw = localStorage.getItem(key);
    if (!raw && !folderId && userId) {
      const legacyKey = `${GOALS_STORAGE_KEY}_folder_${userId}`;
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        localStorage.setItem(key, legacyRaw);
        raw = legacyRaw;
      }
    }
    if (!raw) {
      const rootId = generateUUID();
      const sub1Id = generateUUID();
      const defaults: GoalKanban[] = folderId
        ? [
            {
              id: rootId,
              title: "هدف اصلی این بخش",
              description: "هدف کلی و مسیر پیشرفت این بخش",
              parentId: null,
              timeHorizon: "monthly",
              priority: "high",
              color: "#3b82f6",
              icon: "🎯",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: sub1Id,
              title: "گام‌های اول و یادگیری",
              description: "فعالیت‌های پایه و اقدامات هفتگی",
              parentId: rootId,
              timeHorizon: "weekly",
              priority: "urgent",
              color: "#06b6d4",
              icon: "🚀",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]
        : INITIAL_GOALS;
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return sanitizeGoalsUUIDs(parsed);
    return folderId ? [] : INITIAL_GOALS;
  } catch {
    return folderId ? [] : INITIAL_GOALS;
  }
}

export function saveKanbanGoals(goals: GoalKanban[], folderId?: string | null, userId?: string) {
  const sanitized = sanitizeGoalsUUIDs(goals);
  const baseKey = folderId ? `${GOALS_STORAGE_KEY}_folder_${folderId}` : GOALS_STORAGE_KEY;
  const key = userId ? `${baseKey}_${userId}` : baseKey;
  try {
    localStorage.setItem(key, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("arshnaz-goals-updated", { detail: { folderId, goals: sanitized } }));
  } catch (e) {
    console.error("Failed to save kanban goals:", e);
  }
}

export function getChildGoals(goals: GoalKanban[], parentId: string | null): GoalKanban[] {
  return goals.filter((g) => g.parentId === parentId);
}

export function getGoalById(goals: GoalKanban[], id: string): GoalKanban | undefined {
  return goals.find((g) => g.id === id);
}

export function getGoalPath(goals: GoalKanban[], goalId: string): GoalKanban[] {
  const path: GoalKanban[] = [];
  let current = getGoalById(goals, goalId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getGoalById(goals, current.parentId) : undefined;
  }
  return path;
}
