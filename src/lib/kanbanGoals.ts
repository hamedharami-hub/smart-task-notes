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

const GOALS_STORAGE_KEY = "arshnaz_kanban_goals_v2";

export const INITIAL_GOALS: GoalKanban[] = [
  {
    id: "goal-edu",
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
    id: "goal-edu-lang",
    title: "زبان و مکالمه",
    description: "تمرین روزمره زبان، تقویت اسپیکینگ و دایره واژگان",
    parentId: "goal-edu",
    timeHorizon: "monthly",
    priority: "urgent",
    color: "#06b6d4",
    icon: "🗣️",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "goal-edu-reading",
    title: "خواندن و آموزش با هوش مصنوعی",
    description: "مطالعه کتاب‌های تخصصی و تمرین مکالمه هوش مصنوعی",
    parentId: "goal-edu",
    timeHorizon: "weekly",
    priority: "medium",
    color: "#8b5cf6",
    icon: "🤖",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "goal-career",
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
    id: "goal-health",
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

export function getKanbanGoals(folderId?: string | null, userId?: string): GoalKanban[] {
  const baseKey = folderId ? `${GOALS_STORAGE_KEY}_folder_${folderId}` : GOALS_STORAGE_KEY;
  const key = userId ? `${baseKey}_${userId}` : baseKey;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Create folder-specific default goals if inside folder
      const defaults: GoalKanban[] = folderId
        ? [
            {
              id: `goal-${folderId}-main`,
              title: "هدف اصلی این فولدر",
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
              id: `goal-${folderId}-sub1`,
              title: "گام‌های اول و یادگیری",
              description: "فعالیت‌های پایه و اقدامات هفتگی",
              parentId: `goal-${folderId}-main`,
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_GOALS;
  } catch {
    return INITIAL_GOALS;
  }
}

export function saveKanbanGoals(goals: GoalKanban[], folderId?: string | null, userId?: string) {
  const baseKey = folderId ? `${GOALS_STORAGE_KEY}_folder_${folderId}` : GOALS_STORAGE_KEY;
  const key = userId ? `${baseKey}_${userId}` : baseKey;
  try {
    localStorage.setItem(key, JSON.stringify(goals));
    window.dispatchEvent(new CustomEvent("arshnaz-goals-updated", { detail: { folderId, goals } }));
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
