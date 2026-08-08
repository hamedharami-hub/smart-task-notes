import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { Plus, Calendar, Trash2, ChevronRight, ChevronDown, Flag, GripVertical, CornerDownRight, Ban, Pin, Clock, FolderInput, Check, X, GitBranch } from "lucide-react";
import { MoveToDialog } from "@/components/MoveToDialog";
import { FolderDeleteDialog } from "@/components/FolderDeleteDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BidiText } from "@/components/BidiText";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PRIORITY_META } from "@/lib/priority";
import { FolderKanban } from "@/components/FolderKanban";
import { pushUndo } from "@/lib/undoStack";
import { pushDeleted } from "@/lib/recentlyDeleted";
import { enqueueOp, cacheGet, cacheSet, getPendingOps, type QueuedOp } from "@/lib/offlineQueue";
import { logTaskActivity } from "@/lib/taskActivity";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { describeRule, nextOccurrence } from "@/lib/recurrence";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
  SortableTaskRow,
} from "@/components/TaskDnDHelpers";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

import { TaskFilterSheet, DEFAULT_FILTERS, type TaskFilters, type SortLevel } from "@/components/TaskFilterSheet";
import { QuickAddTask } from "@/components/QuickAddTask";
import { VirtualTaskList } from "@/components/VirtualTaskList";
import { TaskDetail } from "@/components/TaskDetail";
import type { Task, ConfirmState, TaskOutcome, TaskStatus } from "@/lib/taskTypes";
import { OutcomePicker } from "@/components/OutcomePicker";
import { listTaskOutcomes, executeTaskOutcome } from "@/lib/taskOutcomes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SwipeableRow, { type SwipeAction } from "@/components/gestures/SwipeableRow";
import PullToRefresh from "@/components/gestures/PullToRefresh";
import TaskActionSheet from "@/components/TaskActionSheet";
import PomodoroSheet from "@/components/PomodoroSheet";
import { useLongPress } from "@/lib/useLongPress";
import { DueDatePicker } from "@/components/DueDatePicker";
import { RecurrenceEditor } from "@/components/RecurrenceEditor";
import { MakeChildDialog } from "@/components/MakeChildDialog";
import { PRIORITY_SELECTABLE, type Priority } from "@/lib/priority";
import { Repeat } from "lucide-react";
import type { RecurrenceRule } from "@/lib/recurrence";

// Module-level cache shared across mounts: instantly hydrate from last fetch.
const tasksCache = new Map<string, Task[]>();
const TASKS_CACHE_KEY = (userId: string) => `tasks:all:${userId}`;

function outcomeMeta(
  task: Task,
  byTaskId: Record<string, string>,
  byId: Record<string, { label: string; color?: string | null; icon?: string | null }>,
): { label: string; color?: string | null; icon?: string | null } | null {
  const oid = task.outcome_id || byTaskId[task.id];
  if (!oid) return null;
  return byId[oid] || null;
}

function groupedChildren(
  subs: Task[],
  byTaskId: Record<string, string>,
  byId: Record<string, { label: string; color?: string | null; icon?: string | null }>,
): [string | null, { meta?: { label: string; color?: string | null; icon?: string | null }; tasks: Task[] }][] {
  const groups = new Map<string | null, { meta?: { label: string; color?: string | null; icon?: string | null }; tasks: Task[] }>();
  for (const s of subs) {
    const oid = s.outcome_id || byTaskId[s.id] || null;
    if (!groups.has(oid)) {
      groups.set(oid, { meta: oid ? byId[oid] : undefined, tasks: [] });
    }
    groups.get(oid)!.tasks.push(s);
  }
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === null) return -1;
    if (b[0] === null) return 1;
    const la = a[1].meta?.label || "";
    const lb = b[1].meta?.label || "";
    return la.localeCompare(lb);
  });
}

export default function TasksView({ scope }: { scope: "inbox" | "today" | "tomorrow" | "next7" | "smart" | "folder" | "tag" }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const params = useParams();
  const [layout, setLayout] = useState<"compact" | "comfortable">("compact");
  useEffect(() => {
    if (!user) return;
    supabase.from("user_settings").select("task_card_layout").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.task_card_layout) setLayout(data.task_card_layout as any); });
  }, [user]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  // Soft-completed / soft-deleted tasks are kept visible for a short grace period
  // so users see the strikethrough before the item disappears.
  const [graceTasks, setGraceTasks] = useState<Record<string, Task & { _graceUntil: number }>>({});
  const [graceMap, setGraceMap] = useState<Record<string, number>>({});
  const GRACE_MS = 5000;
  const effectiveAllTasks = useMemo(() => {
    const now = Date.now();
    const activeGhosts = Object.values(graceTasks).filter(
      (g) => (graceMap[g.id] || 0) > now && !allTasks.some((t) => t.id === g.id),
    );
    return activeGhosts.length ? [...allTasks, ...activeGhosts] : allTasks;
  }, [allTasks, graceTasks, graceMap]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // selected task removed — clicks navigate to /app/tasks/:id
  const [folderName, setFolderName] = useState("");
  const [tagName, setTagName] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [makeChildOf, setMakeChildOf] = useState<Task | null>(null);
  const [delFolderOpen, setDelFolderOpen] = useState(false);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [pomoTask, setPomoTask] = useState<Task | null>(null);
  const [outcomeTask, setOutcomeTask] = useState<Task | null>(null);
  const [outcomes, setOutcomes] = useState<TaskOutcome[]>([]);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeById, setOutcomeById] = useState<Record<string, { label: string; color?: string | null; icon?: string | null }>>({});
  const [outcomeByTaskId, setOutcomeByTaskId] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Patch a task field optimistically + persist
  const patchTask = async (id: string, patch: Partial<Task>) => {
    const target = effectiveAllTasks.find(t => t.id === id);
    const owner = target ? target.user_id === user?.id : true;
    if (owner) setAllTasks(prev => prev.map(x => x.id === id ? { ...x, ...patch } as Task : x));

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "tasks", op: "update", payload: patch, match: { id } });
      toast.info(T("تغییر ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Saved locally — will sync when online"));
      return;
    }

    const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); if (!owner) return; }
    if (!owner && !error) setAllTasks(prev => prev.map(x => x.id === id ? { ...x, ...patch } as Task : x));
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const SORT_KEY = "task_sort_v2";
  const scopeKey = `${scope}:${params.id || "_"}`;
  const loadSavedFilters = (): TaskFilters => {
    try {
      const raw = localStorage.getItem(SORT_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj[scopeKey]) {
          const saved = obj[scopeKey];
          // Merge into defaults so newly added fields are present
          return {
            ...DEFAULT_FILTERS,
            ...saved,
            sort_primary: saved.sort_primary || DEFAULT_FILTERS.sort_primary,
            sort_secondary: saved.sort_secondary || DEFAULT_FILTERS.sort_secondary,
          };
        }
      }
    } catch { void 0; }
    return DEFAULT_FILTERS;
  };
  const [filters, setFilters] = useState<TaskFilters>(loadSavedFilters());
  // Reload saved filters when scope/folder/tag changes
  useEffect(() => {
    setFilters(loadSavedFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, params.id]);
  // Persist whole filter object per-scope
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SORT_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj[scopeKey] = filters;
      localStorage.setItem(SORT_KEY, JSON.stringify(obj));
    } catch { void 0; }
  }, [filters, scopeKey]);
  const [taskTagsMap, setTaskTagsMap] = useState<Record<string, string[]>>({});

  // Load task->tags mapping for tag filtering
  useEffect(() => {
    if (!user) return;
    supabase.from("task_tags").select("task_id,tag_id").then(({ data }) => {
      const m: Record<string, string[]> = {};
      (data || []).forEach((row: any) => {
        (m[row.task_id] ||= []).push(row.tag_id);
      });
      setTaskTagsMap(m);
    });
  }, [user, allTasks.length]);

  // Load outcome labels and task→outcome mappings so branch subtasks show their branch
  useEffect(() => {
    if (!user || effectiveAllTasks.length === 0) return;
    const parentIds = [...new Set(effectiveAllTasks.filter(t => !t.parent_id).map(t => t.id))];
    if (parentIds.length === 0) return;
    (async () => {
      const [{ data: outcomesData }, { data: execsData }] = await Promise.all([
        supabase.from("task_outcomes").select("id,label,color,icon,task_id").in("task_id", parentIds),
        supabase.from("outcome_executions").select("outcome_id,created_task_ids,task_id").in("task_id", parentIds),
      ]);
      const byId: Record<string, { label: string; color?: string | null; icon?: string | null }> = {};
      (outcomesData || []).forEach((o: any) => {
        byId[o.id] = { label: o.label, color: o.color, icon: o.icon };
      });
      const byTaskId: Record<string, string> = {};
      (execsData || []).forEach((e: any) => {
        (e.created_task_ids || []).forEach((tid: string) => { byTaskId[tid] = e.outcome_id; });
      });
      setOutcomeById(byId);
      setOutcomeByTaskId(byTaskId);
    })();
  }, [effectiveAllTasks, user]);

  const title = {
    inbox: T("صندوق ورودی", "Inbox"), today: T("امروز", "Today"), tomorrow: T("فردا", "Tomorrow"), next7: T("۷ روز آینده", "Next 7 Days"),
    smart: T("لیست‌های هوشمند", "Smart Lists"), folder: folderName || T("فولدر", "Folder"), tag: `#${tagName || T("تگ", "Tag")}`,
  }[scope];

  // Build children map
  const childrenMap = useMemo(() => {
    const m: Record<string, Task[]> = {};
    effectiveAllTasks.forEach(t => {
      if (t.parent_id) (m[t.parent_id] ||= []).push(t);
    });
    return m;
  }, [effectiveAllTasks]);

  // Module-scoped cache so navigating between scopes (or remounts) reuses
  // the last task list instantly instead of waiting on a roundtrip.
  // Keyed by user.id; survives unmount but resets on page reload.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const cache = tasksCache;

  const lastLoadRef = (TasksView as any)._lastLoadRef ||= { current: 0 };
  const inflightRef = (TasksView as any)._inflightRef ||= { current: null as Promise<void> | null };
  const MIN_INTERVAL_MS = 1500; // throttle: at most one fetch per 1.5s

  const fetchAll = async (force = false): Promise<void> => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastLoadRef.current < MIN_INTERVAL_MS && cache.get(user.id)) {
      return; // recent fetch + cache → skip
    }
    if (inflightRef.current) return inflightRef.current;
    lastLoadRef.current = now;
    const p = (async () => {
      try {
        const { data: allData } = await supabase.from("tasks")
          .select("*")
          .order("position").order("created_at", { ascending: false })
          .limit(2000);
        const all = ((allData || []) as unknown) as Task[];
        cache.set(user.id, all);
        setAllTasks(all);
        await cacheSet(TASKS_CACHE_KEY(user.id), all);
      } catch {
        // Offline/network error: keep cache and persisted IndexedDB list
        const persisted = await cacheGet<Task[]>(TASKS_CACHE_KEY(user.id));
        if (persisted) {
          cache.set(user.id, persisted);
          setAllTasks(persisted);
        }
      }
    })();
    inflightRef.current = p;
    try { await p; } finally { inflightRef.current = null; }
  };

  const applyTaskQueue = async (base: Task[]): Promise<Task[]> => {
    const ops = await getPendingOps("tasks");
    const inserts = new Map<string, Task>();
    const deletes = new Set<string>();
    const updates = new Map<string, Partial<Task>>();
    for (const op of ops) {
      if (op.op === "insert" && op.payload) {
        const p = op.payload as Task;
        if (p && p.id) inserts.set(p.id, p);
      } else if (op.op === "delete" && op.match?.id) {
        deletes.add(op.match.id as string);
      } else if (op.op === "update" && op.match?.id && op.payload) {
        const id = op.match.id as string;
        updates.set(id, { ...(updates.get(id) || {}), ...(op.payload as Partial<Task>) });
      }
    }
    let next = base.filter(t => !deletes.has(t.id));
    for (const t of inserts.values()) {
      if (!next.some(x => x.id === t.id)) next = [t, ...next];
    }
    next = next.map(t => updates.has(t.id) ? { ...t, ...updates.get(t.id) } : t);
    return next;
  };

  const load = async () => {
    if (!user) return;
    // Serve cached list synchronously on mount/scope-switch — refetch in background
    const cached = cache.get(user.id);
    let base = cached || (await cacheGet<Task[]>(TASKS_CACHE_KEY(user.id))) || [];
    base = await applyTaskQueue(base);
    cache.set(user.id, base);
    setAllTasks(base);
    await fetchAll(!cache.get(user.id));

    if (typeof navigator !== "undefined" && navigator.onLine) {
      if (scope === "folder" && params.id) {
        const { data: f } = await supabase.from("folders").select("name").eq("id", params.id).single();
        if (f) setFolderName(f.name);
      } else if (scope === "tag" && params.id) {
        const { data: tg } = await supabase.from("tags").select("name").eq("id", params.id).single();
        if (tg) setTagName(tg.name);
      }
    }
  };

  useEffect(() => { load(); }, [user, scope, params.id]);

  useEffect(() => {
    if (!user) return;
    // Coalesce bursty realtime events + enforce min interval between fetches.
    // - debounce 600ms: many rows in one bulk-update collapse into 1 fetch
    // - throttle 1.5s: prevents thrash if events keep streaming
    // - pause while tab hidden: refetch once on visibility return
    let pending: number | null = null;
    let dirty = false;
    const flush = () => {
      pending = null;
      if (document.hidden) { dirty = true; return; }
      dirty = false;
      fetchAll();
    };
    const scheduleLoad = () => {
      if (pending != null) window.clearTimeout(pending);
      pending = window.setTimeout(flush, 600);
    };
    const onVisible = () => {
      if (!document.hidden && dirty) { dirty = false; fetchAll(true); }
    };
    document.addEventListener("visibilitychange", onVisible);
    const onTasksChanged = () => load();
    window.addEventListener("tasks-changed", onTasksChanged);
    const ch = supabase.channel(`tasks-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "subtasks" }, scheduleLoad)
      .subscribe();
    return () => {
      if (pending != null) window.clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("tasks-changed", onTasksChanged);
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Keep cache in sync when optimistic local edits change the in-memory list
  useEffect(() => {
    if (user && allTasks.length) cache.set(user.id, allTasks);
  }, [allTasks, user]);

  // Filter top-level visible tasks per scope
  const topLevel = useMemo(() => {
    const nowMs = Date.now();
    const isGraceActive = (id: string) => (graceMap[id] || 0) > nowMs;
    let list = effectiveAllTasks.filter(t => !t.parent_id);
    if (scope === "inbox") list = list.filter(t => !t.folder_id);
    else if (scope === "today") {
      // Show overdue tasks plus today so the Today view matches TickTick (Overdue + Today groups)
      const e = endOfDay(new Date()).getTime();
      list = list.filter(t => t.due_date && new Date(t.due_date).getTime() <= e);
    } else if (scope === "tomorrow") {
      const s = startOfDay(addDays(new Date(), 1)).getTime();
      const e = endOfDay(addDays(new Date(), 1)).getTime();
      list = list.filter(t => t.due_date && new Date(t.due_date).getTime() >= s && new Date(t.due_date).getTime() <= e);
    } else if (scope === "next7") {
      // Show overdue plus next 7 days for grouped Upcoming view
      const e = endOfDay(addDays(new Date(), 7)).getTime();
      list = list.filter(t => t.due_date && new Date(t.due_date).getTime() <= e);
    } else if (scope === "smart") {
      list = list.filter(t => t.priority === "high" && (!t.completed || isGraceActive(t.id)));
    } else if (scope === "folder") {
      list = list.filter(t => t.folder_id === params.id);
    }

    // Apply advanced filters
    if (!filters.show_completed) list = list.filter(t => !t.completed || isGraceActive(t.id));
    if (filters.folder_ids.length) list = list.filter(t => t.folder_id && filters.folder_ids.includes(t.folder_id));
    if (filters.priorities.length) list = list.filter(t => filters.priorities.includes(t.priority as string));
    if (filters.tag_ids.length) {
      list = list.filter(t => {
        const tgs = taskTagsMap[t.id] || [];
        return filters.tag_ids.some(id => tgs.includes(id));
      });
    }

    // Apply two-level sort
    const cmpForLevel = (lvl: SortLevel) => (a: Task, b: Task): number => {
      let res = 0;
      switch (lvl.key) {
        case "due": {
          const av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          res = av - bv;
          break;
        }
        case "priority":
          res = (PRIORITY_META[a.priority]?.rank ?? 3) - (PRIORITY_META[b.priority]?.rank ?? 3);
          break;
        case "created":
          res = new Date((a as any).created_at).getTime() - new Date((b as any).created_at).getTime();
          break;
      }
      return lvl.dir === "desc" ? -res : res;
    };
    const primary = filters.sort_primary || DEFAULT_FILTERS.sort_primary;
    const secondary = filters.sort_secondary || DEFAULT_FILTERS.sort_secondary;
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return cmpForLevel(primary)(a, b) || cmpForLevel(secondary)(a, b);
    });
    return list;
  }, [effectiveAllTasks, scope, params.id, filters, taskTagsMap, graceMap]);

  const taskMap = useMemo(() => new Map(effectiveAllTasks.map(t => [t.id, t])), [effectiveAllTasks]);

  // Date-based grouping for Today/Next7 to mimic TickTick (Overdue, Today, Tomorrow, ...)
  type TaskGroup = { key: string; label: string; tasks: Task[] };
  const groupedTasks = useMemo<TaskGroup[] | null>(() => {
    if (scope !== "today" && scope !== "next7") return null;
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const todayEnd = endOfDay(now).getTime();
    const tomorrowStart = startOfDay(addDays(now, 1)).getTime();
    const tomorrowEnd = endOfDay(addDays(now, 1)).getTime();
    const sorted = [...topLevel].sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (da !== db) return da - db;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (PRIORITY_META[a.priority]?.rank ?? 3) - (PRIORITY_META[b.priority]?.rank ?? 3);
    });
    const groups = new Map<string, TaskGroup>();
    for (const task of sorted) {
      if (!task.due_date) continue;
      const due = new Date(task.due_date).getTime();
      let key: string;
      let label: string;
      if (due < todayStart) {
        key = "overdue";
        label = T("تاخیر", "Overdue");
      } else if (due <= todayEnd) {
        key = "today";
        label = T("امروز", "Today");
      } else if (due <= tomorrowEnd) {
        key = "tomorrow";
        label = T("فردا", "Tomorrow");
      } else {
        const d = new Date(task.due_date);
        key = format(d, "yyyy-MM-dd");
        label = d.toLocaleDateString(isEn ? "en-US" : "fa-IR", { weekday: "long", month: "short", day: "numeric" });
      }
      if (!groups.has(key)) groups.set(key, { key, label, tasks: [] });
      groups.get(key)!.tasks.push(task);
    }
    // Preserve Overdue -> Today -> Tomorrow -> chronological day order
    const orderedKeys: string[] = [];
    if (groups.has("overdue")) orderedKeys.push("overdue");
    if (groups.has("today")) orderedKeys.push("today");
    if (groups.has("tomorrow")) orderedKeys.push("tomorrow");
    [...groups.keys()]
      .filter(k => !["overdue", "today", "tomorrow"].includes(k))
      .sort()
      .forEach(k => orderedKeys.push(k));
    return orderedKeys.map(k => groups.get(k)!);
  }, [topLevel, scope]);

  const completeTaskCore = async (t: Task, outcome: TaskOutcome | null, isOwner: boolean) => {
    const patch = { completed: true, status: "done" as const, completed_at: new Date().toISOString() };
    if (isOwner) setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } as Task : x));

    // Keep the completed task visible (with strikethrough) for a few seconds
    const until = Date.now() + GRACE_MS;
    setGraceMap(prev => ({ ...prev, [t.id]: until }));
    window.setTimeout(() => {
      setGraceMap(prev => { const n = { ...prev }; delete n[t.id]; return n; });
    }, GRACE_MS);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "tasks", op: "update", payload: patch, match: { id: t.id } });
      toast.info(T("تغییر ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Saved locally — will sync when online"));
      return;
    }

    const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    if (!isOwner) setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } as Task : x));
    if (user) await logTaskActivity(t.id, user.id, "completed", { ...patch, outcome_id: outcome?.id } as Record<string, unknown>);
  };

  const completeTask = async (t: Task, outcome: TaskOutcome | null = null) => {
    const isOwner = t.user_id === user?.id;

    if (outcome && user) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.info(T("اتصال اینترنت برای اجرای سناریو لازم است", "Internet connection required to run outcome scenario"));
      } else {
        try {
          await executeTaskOutcome(outcome, user.id, t);
          toast.success(`${outcome.actions.length} ${T("تسک ساخته شد", "follow-up tasks created")}`);
        } catch (e: any) {
          toast.error(e.message || T("خطا در ساخت تسک‌ها", "Error creating tasks"));
          return;
        }
      }
    }

    await completeTaskCore(t, outcome, isOwner);
  };

  const reopenTask = async (t: Task) => {
    const isOwner = t.user_id === user?.id;
    const patch = { completed: false, status: "todo" as const, completed_at: null as string | null };
    if (isOwner) setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } as Task : x));
    // Cancel any pending grace for this task
    setGraceMap(prev => { const n = { ...prev }; delete n[t.id]; return n; });
    setGraceTasks(prev => { const n = { ...prev }; delete n[t.id]; return n; });

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "tasks", op: "update", payload: patch, match: { id: t.id } });
      toast.info(T("تغییر ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Saved locally — will sync when online"));
      return;
    }

    const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    if (!isOwner) setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } as Task : x));
    if (user) await logTaskActivity(t.id, user.id, "reopened", patch as Record<string, unknown>);
  };

  const toggleTask = async (t: Task) => {
    const newCompleted = !t.completed;

    if (!newCompleted) {
      await reopenTask(t);
      return;
    }

    if (t.recurrence_rule && user) {
      const now = new Date();
      let next = nextOccurrence(t.recurrence_rule, t.due_date ? new Date(t.due_date) : now);
      let guard = 0;
      while (next && next < now && guard < 500) {
        const advanced = nextOccurrence(t.recurrence_rule, next);
        if (!advanced || advanced <= next) break;
        next = advanced;
        guard++;
      }
      if (next) {
        let nextReminderIso: string | null = null;
        if (t.reminder_at && t.due_date) {
          const delta = next.getTime() - new Date(t.due_date).getTime();
          nextReminderIso = new Date(new Date(t.reminder_at).getTime() + delta).toISOString();
        } else if (t.reminder_at) {
          nextReminderIso = next.toISOString();
        }
        const patch: any = {
          due_date: next.toISOString(),
          reminder_at: nextReminderIso,
          completed: false,
          completed_at: null,
        };
        if (t.user_id === user?.id) setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x));

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueueOp({ table: "tasks", op: "update", payload: patch, match: { id: t.id } });
          toast.info(T("تغییر ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Saved locally — will sync when online"));
          return;
        }

        const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
        if (error) { toast.error(error.message); return; }
        if (t.user_id !== user?.id) setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x));
        toast.success(T(`نمونه بعدی به ${format(next, "yyyy-MM-dd HH:mm")} منتقل شد 🔁`, `Next instance moved to ${format(next, "yyyy-MM-dd HH:mm")} 🔁`));
        return;
      }
    }

    try {
      const outs = await listTaskOutcomes(t.id);
      if (outs.length > 0) {
        setOutcomeTask(t);
        setOutcomes(outs);
        setOutcomeOpen(true);
        return;
      }
    } catch (e) {
      // No outcomes or network error; proceed to normal completion.
    }

    await completeTask(t);
  };

  const delTask = async (id: string) => {
    const target = effectiveAllTasks.find(t => t.id === id);
    if (target && target.user_id !== user?.id) { toast(T("فقط صاحب تسک می‌تواند حذف کند", "Only the task owner can delete")); return; }
    // snapshot task + descendants + tag links for undo
    const collectIds = (rid: string): string[] => {
      const out = [rid];
      const kids = effectiveAllTasks.filter(t => t.parent_id === rid);
      kids.forEach(k => out.push(...collectIds(k.id)));
      return out;
    };
    const ids = collectIds(id);
    const snaps = allTasks.filter(t => ids.includes(t.id));
    const until = Date.now() + GRACE_MS;
    // Keep deleted task(s) visible with strikethrough for a short grace period
    const ghosts: Record<string, Task & { _graceUntil: number }> = {};
    for (const s of snaps) {
      ghosts[s.id] = { ...s, completed: true, status: "done" as TaskStatus, _graceUntil: until };
    }
    let tagLinks: Record<string, unknown>[] | null = null;
    if (typeof navigator === "undefined" || navigator.onLine) {
      const { data } = await supabase.from("task_tags").select("*").in("task_id", ids);
      tagLinks = (data as Record<string, unknown>[] | null) || null;
    }
    setAllTasks(prev => prev.filter(t => !ids.includes(t.id)));
    setGraceTasks(prev => ({ ...prev, ...ghosts }));
    setGraceMap(prev => ({ ...prev, ...Object.fromEntries(ids.map(i => [i, until])) }));
    window.setTimeout(() => {
      setGraceTasks(prev => { const n = { ...prev }; ids.forEach(i => delete n[i]); return n; });
      setGraceMap(prev => { const n = { ...prev }; ids.forEach(i => delete n[i]); return n; });
    }, GRACE_MS);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "tasks", op: "delete", match: { id } });
      toast.info(T("حذف ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Delete saved locally — will sync when online"));
      return;
    }

    await supabase.from("tasks").delete().eq("id", id);
    const title = snaps.find(s => s.id === id)?.title || "";
    const restore = async () => {
      await supabase.from("tasks").insert(snaps as never);
      if (tagLinks?.length) await supabase.from("task_tags").insert(tagLinks as never);
      load();
    };
    pushUndo({ label: T(`تسک «${title}» حذف شد`, `Task "${title}" deleted`), undo: restore });
    pushDeleted({ kind: "task", label: title, restore });
  };

  const askDeleteTask = (t: Task) => {
    if (t.user_id !== user?.id) { toast(T("فقط صاحب تسک می‌تواند حذف کند", "Only the task owner can delete")); return; }
    const childCount = (childrenMap[t.id] || []).length;
    setConfirm({
      kind: "task",
      id: t.id,
      title: t.title,
      onConfirm: async () => { await delTask(t.id); },
    });
    // include child count info via title hack (handled in dialog body)
    (window as any).__lastChildCount = childCount;
  };

  // Compute progress including nested descendants
  const getProgress = (id: string): { done: number; total: number } => {
    const subs = childrenMap[id] || [];
    if (!subs.length) return { done: 0, total: 0 };
    let done = 0, total = 0;
    for (const s of subs) {
      total += 1;
      if (s.completed) done += 1;
      const child = getProgress(s.id);
      done += child.done;
      total += child.total;
    }
    return { done, total };
  };

  // Drag & drop: drop a task onto another → set as child; drop in same parent zone → reorder
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDragId(null);
    // Date-grouped views (Today/Next7) sort tasks by due date; manual reorder is disabled there.
    if (scope === "today" || scope === "next7") return;
    const { active, over, delta } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = effectiveAllTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Helper: when promoting a task to top-level, also fill scope-defining fields
    // so it doesn't disappear from the current view.
    const scopeRootPatch = (): Record<string, any> => {
      const sc = scope as string;
      const patch: Record<string, any> = { parent_id: null };
      const today = startOfDay(new Date()).toISOString();
      const tomorrowIso = addDays(new Date(), 1).toISOString();
      if (sc === "today") patch.due_date = today;
      else if (sc === "tomorrow") patch.due_date = tomorrowIso;
      else if (sc === "next7" && !activeTask.due_date) patch.due_date = tomorrowIso;
      else if (sc === "folder") patch.folder_id = params.id || null;
      return patch;
    };

    if (overId.startsWith("child:")) {
      const newParent = overId.slice(6);
      if (newParent === activeId) return;
      // prevent cycles
      let p: string | null = newParent;
      while (p) {
        if (p === activeId) { toast.error(T("نمی‌توان داخل خودش انداخت", "Cannot move a task into itself")); return; }
        const pt = effectiveAllTasks.find(x => x.id === p);
        p = pt?.parent_id || null;
      }
      setAllTasks(prev => prev.map(t => t.id === activeId ? { ...t, parent_id: newParent } : t));
      setExpanded(s => ({ ...s, [newParent]: true }));
      const { error } = await supabase.from("tasks").update({ parent_id: newParent }).eq("id", activeId);
      if (error) toast.error(error.message);
      return;
    }
    if (overId === "root") {
      const patch = scopeRootPatch();
      setAllTasks(prev => prev.map(t => t.id === activeId ? { ...t, ...patch } as Task : t));
      const { error } = await supabase.from("tasks").update(patch as any).eq("id", activeId);
      if (error) toast.error(error.message);
      return;
    }
    // Dropped on another task row
    const overTask = effectiveAllTasks.find(t => t.id === overId);
    if (!overTask) return;

    // TickTick-style: if user dragged horizontally significantly, treat as INDENT
    // (make active a subtask of over) instead of reorder.
    const HORIZONTAL_INDENT = 40;
    if (delta && Math.abs(delta.x) > HORIZONTAL_INDENT && Math.abs(delta.x) > Math.abs(delta.y)) {
      // prevent cycles
      let p: string | null = overId;
      while (p) {
        if (p === activeId) { toast.error(T("نمی‌توان داخل خودش انداخت", "Cannot move a task into itself")); return; }
        const pt = effectiveAllTasks.find(x => x.id === p);
        p = pt?.parent_id || null;
      }
      setAllTasks(prev => prev.map(t => t.id === activeId ? { ...t, parent_id: overId } : t));
      setExpanded(s => ({ ...s, [overId]: true }));
      const { error } = await supabase.from("tasks").update({ parent_id: overId }).eq("id", activeId);
      if (error) toast.error(error.message);
      return;
    }

    // Otherwise: reorder among siblings (or move to over's parent if different)
    const siblings = overTask.parent_id
      ? (childrenMap[overTask.parent_id] || [])
      : topLevel;
    const fromIdx = siblings.findIndex(s => s.id === activeId);
    const toIdx = siblings.findIndex(s => s.id === overId);
    if (activeTask.parent_id !== overTask.parent_id) {
      // Moving across parents. If target is top-level (no parent), inherit scope.
      const patch: Record<string, any> = overTask.parent_id
        ? { parent_id: overTask.parent_id }
        : scopeRootPatch();
      setAllTasks(prev => prev.map(t => t.id === activeId ? { ...t, ...patch } as Task : t));
      await supabase.from("tasks").update(patch as any).eq("id", activeId);
      return;
    }
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = arrayMove(siblings, fromIdx, toIdx);
    const updates = reordered.map((s, i) =>
      supabase.from("tasks").update({ position: i }).eq("id", s.id)
    );
    setAllTasks(prev => {
      const map = new Map(reordered.map((s, i) => [s.id, i]));
      return [...prev].sort((a, b) => {
        const ai = map.get(a.id); const bi = map.get(b.id);
        if (ai !== undefined && bi !== undefined) return ai - bi;
        return 0;
      }).map(t => map.has(t.id) ? { ...t, position: map.get(t.id)! } : t);
    });
    await Promise.all(updates);
  };

  const moveSibling = async (t: Task, dir: -1 | 1) => {
    const siblings = t.parent_id ? (childrenMap[t.parent_id] || []) : topLevel;
    const idx = siblings.findIndex(s => s.id === t.id);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= siblings.length) return;
    const reordered = arrayMove(siblings, idx, newIdx);
    const map = new Map(reordered.map((s, i) => [s.id, i]));
    setAllTasks(prev => prev.map(x => map.has(x.id) ? { ...x, position: map.get(x.id)! } : x));
    await Promise.all(reordered.map((s, i) =>
      supabase.from("tasks").update({ position: i }).eq("id", s.id)
    ));
  };

  const TaskItem = ({ t, depth = 0 }: { t: Task; depth?: number }) => {
    const subs = childrenMap[t.id] || [];
    const open = expanded[t.id];
    const pm = PRIORITY_META[t.priority] || PRIORITY_META.none;
    const prog = getProgress(t.id);
    const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
    const parent = t.parent_id ? effectiveAllTasks.find(x => x.id === t.parent_id) : null;
    const STEP = 18; // px per nesting level
    const lp = useLongPress({ onLongPress: () => setActionTask(t) });
    return (
      <div className="relative swipe-row" style={{ paddingInlineStart: depth * STEP }} {...lp.handlers}>
        {/* Vertical guide lines for each ancestor level */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-0 bottom-0 w-px bg-border/70 pointer-events-none"
            style={{ insetInlineStart: i * STEP + 7 }}
          />
        ))}
        {/* Horizontal connector from parent line to this card */}
        {depth > 0 && (
          <span
            aria-hidden
            className="absolute h-px bg-border/70 pointer-events-none"
            style={{ insetInlineStart: (depth - 1) * STEP + 7, top: 20, width: STEP - 4 }}
          />
        )}
        <SortableTaskRow id={t.id}>
          {(dragHandle) => (
            <SwipeableRow
              disabled={t.user_id !== user?.id}
              rightActions={[
                {
                  id: "complete",
                  label: t.completed ? T("بازگشایی", "Reopen") : T("تکمیل", "Complete"),
                  icon: Check,
                  baseClass: "bg-emerald-500/80",
                  activeClass: "bg-emerald-700",
                  textClass: "text-white",
                  fullSwipe: true,
                  onActivate: () => toggleTask(t),
                },
                {
                  id: "pin",
                  label: t.pinned ? T("حذف پین", "Unpin") : T("پین", "Pin"),
                  icon: Pin,
                  baseClass: "bg-primary/70",
                  activeClass: "bg-primary",
                  textClass: "text-white",
                  onActivate: () => patchTask(t.id, { pinned: !t.pinned }),
                },
                {
                  id: "today",
                  label: T("امروز", "Today"),
                  icon: Calendar,
                  baseClass: "bg-blue-500/80",
                  activeClass: "bg-blue-700",
                  textClass: "text-white",
                  onActivate: () => patchTask(t.id, { due_date: startOfDay(new Date()).toISOString() }),
                },
              ] as SwipeAction[]}
              leftActions={[
                {
                  id: "delete",
                  label: T("حذف", "Delete"),
                  icon: Trash2,
                  baseClass: "bg-destructive/80",
                  activeClass: "bg-red-700",
                  textClass: "text-white",
                  fullSwipe: true,
                  onActivate: () => askDeleteTask(t),
                },
                {
                  id: "tomorrow",
                  label: T("فردا", "Tomorrow"),
                  icon: Clock,
                  baseClass: "bg-amber-500/80",
                  activeClass: "bg-amber-700",
                  textClass: "text-white",
                  onActivate: () => patchTask(t.id, { due_date: addDays(startOfDay(new Date()), 1).toISOString() }),
                },
                {
                  id: "move",
                  label: T("انتقال", "Move"),
                  icon: FolderInput,
                  baseClass: "bg-slate-500/80",
                  activeClass: "bg-slate-700",
                  textClass: "text-white",
                  onActivate: () => setMoveTask(t),
                },
              ] as SwipeAction[]}
            >
            <Card className={`rounded-lg ${layout === "compact" ? "p-1.5" : "p-2"} border-s-[3px] ${pm.borderClass} ${t.is_avoidance ? "bg-amber-500/[0.04] border-amber-500/30" : ""} ${depth > 0 ? "bg-muted/20" : "bg-card/50"} hover:bg-accent/20 transition-colors`}>
              {depth > 0 && parent && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground/80">
                  <CornerDownRight className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{T(`سطح ${depth} · زیرِ «${parent.title}»`, `Level ${depth} · under "${parent.title}"`)}</span>
                </div>
              )}
              {/* Row 1: chevron + pin + TITLE (wide) + checkbox (right) */}
              <div dir="rtl" className="flex items-start gap-1.5">
                {subs.length > 0 ? (
                  <button onClick={() => setExpanded((s) => ({ ...s, [t.id]: !open }))} className="text-muted-foreground hover:text-foreground shrink-0 pt-0.5">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                ) : <span className="w-4 shrink-0" />}
                <button
                  onClick={(e) => { e.stopPropagation(); patchTask(t.id, { pinned: !t.pinned }); }}
                  disabled={t.user_id !== user?.id}
                  className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded transition mt-0.5 ${t.pinned ? "text-primary" : "text-muted-foreground/40 hover:text-foreground"} ${t.user_id !== user?.id ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={t.pinned ? T("حذف پین", "Unpin") : T("پین کردن", "Pin")}
                  data-no-longpress
                >
                  <Pin className={`w-3 h-3 ${t.pinned ? "fill-primary" : ""}`} />
                </button>
                <div
                  className="flex-1 min-w-0 cursor-pointer select-none"
                  onClick={() => {
                    if (t.title.startsWith("چک‌این روزانه") || t.title.startsWith("Daily Check-in")) { navigate("/app/checkin"); return; }
                    setSelectedTask(t);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    toggleTask(t);
                  }}
                >
                  {t.status === "wont_do" && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-sky-500/10 text-sky-600 ms-1 shrink-0">
                      <X className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <BidiText
                    as="p"
                    text={t.title}
                    className={`${layout === "compact" ? "text-sm" : "text-[15px]"} font-medium leading-tight break-words ${t.completed ? "line-through text-muted-foreground" : t.status === "wont_do" ? "text-sky-600" : "text-foreground/90"}`}
                  />
                </div>
                {t.is_avoidance ? (
                  <button
                    onClick={() => toggleTask(t)}
                    title={t.completed ? T("موفق به اجتناب — لغو", "Avoidance succeeded — undo") : T("علامت بزن: موفق به اجتناب شدم", "Mark: I successfully avoided")}
                    className={`mt-0.5 shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition ${
                      t.completed
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-amber-500/60 text-amber-600 hover:bg-amber-500/10"
                    }`}
                  >
                    <Ban className="w-3 h-3" />
                  </button>
                ) : (
                  <Checkbox checked={t.completed} onCheckedChange={() => toggleTask(t)} className="mt-1 shrink-0" />
                )}
              </div>

              {/* Row 2: metadata */}
              <div className="flex items-center gap-1.5 mt-1 ms-5 flex-wrap min-h-[20px]" dir="rtl">
                <button {...dragHandle} data-drag-handle data-no-swipe-nav className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 h-5 w-5 rounded flex items-center justify-center" aria-label={T("جابجایی", "Drag")} title={T("جابجایی", "Drag")}>
                  <GripVertical className="w-3 h-3" />
                </button>
                {t.is_avoidance && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 h-4 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <Ban className="w-2.5 h-2.5" /> {T("اجتنابی", "Avoidance")}
                  </span>
                )}
                {(t.priority as string) !== "none" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={`text-[10px] gap-0.5 px-1.5 py-0 h-[18px] inline-flex items-center rounded border ${pm.bgClass} ${pm.textClass}`}
                        title={T("تغییر اولویت", "Change priority")}
                      >
                        <Flag className="w-2.5 h-2.5" /> {T(pm.label, pm.labelEn)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                      {PRIORITY_SELECTABLE.map(p => {
                        const m = PRIORITY_META[p];
                        return (
                          <button key={p}
                            onClick={() => patchTask(t.id, { priority: p as Priority })}
                            className={`w-full text-start px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 ${t.priority === p ? "bg-accent" : ""}`}>
                            <Flag className={`w-3 h-3 ${m.textClass}`} /> {T(m.label, m.labelEn)}
                          </button>
                        );
                      })}
                      {(t.priority as string) !== "none" && (
                        <button onClick={() => patchTask(t.id, { priority: "none" as Priority })}
                          className="w-full text-start px-2 py-1.5 text-xs rounded hover:bg-accent text-muted-foreground border-t mt-1">
                          {T("حذف اولویت", "Remove priority")}
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
                {t.due_date && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] gap-0.5 px-1.5 py-0 h-[18px] inline-flex items-center rounded border bg-secondary text-secondary-foreground"
                        title={T("تغییر تاریخ", "Change date")}
                      >
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(t.due_date), "MMM d, HH:mm")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start" onClick={(e) => e.stopPropagation()}>
                      <DueDatePicker
                        value={t.due_date}
                        onChange={(iso) => patchTask(t.id, { due_date: iso })}
                        reminderValue={t.reminder_at}
                        onReminderChange={(iso) => patchTask(t.id, { reminder_at: iso })}
                        label=""
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {t.recurrence_rule && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] gap-0.5 px-1.5 py-0 h-[18px] inline-flex items-center rounded border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25"
                        title={T("تغییر تکرار", "Change repeat")}
                      >
                        <Repeat className="w-2.5 h-2.5" /> {describeRule(t.recurrence_rule, isEn)}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                      <RecurrenceEditor
                        value={t.recurrence_rule}
                        onChange={(rule: RecurrenceRule | null) => patchTask(t.id, { recurrence_rule: rule, recurrence: rule ? (rule.freq as any) : "none" })}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {subs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                    <CornerDownRight className="w-3 h-3" /> {prog.done}/{prog.total}
                  </span>
                )}
                {(() => {
                  const ometa = outcomeMeta(t, outcomeByTaskId, outcomeById);
                  if (!ometa) return null;
                  return (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] px-1.5 h-4 rounded border"
                      style={{ borderColor: ometa.color || "hsl(var(--primary))", background: ometa.color ? `${ometa.color}20` : "hsl(var(--primary) / 0.1)" }}
                    >
                      <GitBranch className="w-2.5 h-2.5" />
                      <span style={{ color: ometa.color || undefined }}>{ometa.label}</span>
                    </span>
                  );
                })()}
              </div>
            </Card>
            </SwipeableRow>
          )}
        </SortableTaskRow>
        {open && subs.length > 0 && (
          <div className="mt-1 space-y-2">
            {groupedChildren(subs, outcomeByTaskId, outcomeById).map(([oid, group]) => (
              <div key={oid ?? "root"} className="space-y-1">
                {group.meta && (
                  <div className="flex items-center gap-1.5 ps-5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: group.meta.color || "hsl(var(--primary))", color: "#fff" }}
                    >
                      {group.meta.icon || "•"}
                    </span>
                    <span>{group.meta.label}</span>
                  </div>
                )}
                <SortableContext items={group.tasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {group.tasks.map((s) => <TaskItem key={s.id} t={s} depth={depth + 1} />)}
                </SortableContext>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isFolder = scope === "folder" && !!params.id;

  const listView = (
    <PullToRefresh onRefresh={load}>
      <div className="flex gap-1.5 mb-3 items-center">
        <div className="flex-1">
          <QuickAddTask
            defaults={{
              folder_id: scope === "folder" ? params.id || null : null,
              due_date: scope === "today"
                ? new Date().toISOString()
                : scope === "next7"
                  ? addDays(new Date(), 1).toISOString()
                  : null,
              tag_id: scope === "tag" ? params.id || null : null,
            }}
            onCreated={() => load()}
          />
        </div>
        <TaskFilterSheet filters={filters} onChange={setFilters} />
      </div>

      {(() => {
        const isEmpty = groupedTasks ? groupedTasks.length === 0 : topLevel.length === 0;
        const sortableItems = groupedTasks
          ? groupedTasks.flatMap(g => g.tasks.map(t => t.id))
          : topLevel.map(t => t.id);
        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="space-y-1 mt-1">
              {isEmpty && (
                <Card className="p-5 text-center text-muted-foreground text-sm border-dashed">{T("هیچ تسکی نیست", "No tasks")}</Card>
              )}
              <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                {groupedTasks ? (
                  <div className="space-y-3">
                    {groupedTasks.map(group => (
                      <div key={group.key}>
                        <div className="sticky top-0 z-[5] bg-background/95 backdrop-blur py-1 px-1 text-sm font-semibold text-foreground/80 flex items-center justify-between">
                          <span>{group.label}</span>
                          <span className="text-xs text-muted-foreground font-normal">{group.tasks.length}</span>
                        </div>
                        <div className="space-y-1">
                          {group.tasks.map(t => <TaskItem key={t.id} t={t} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <VirtualTaskList
                    itemIds={topLevel.map(t => t.id)}
                    renderItem={(id) => {
                      const t = taskMap.get(id);
                      if (!t) return null;
                      return <TaskItem t={t} />;
                    }}
                  />
                )}
              </SortableContext>
            </div>
            <DragOverlay>
              {activeDragId ? (
                <Card className="p-3 shadow-lg opacity-90">
                  <p className="text-sm font-medium">
                    {effectiveAllTasks.find(x => x.id === activeDragId)?.title || "..."}
                  </p>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        );
      })()}
    </PullToRefresh>
  );

  return (
    <div className="p-2 sm:p-3 md:p-4 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <BidiText as="h1" text={title} className="text-xl md:text-2xl font-bold" />
        {isFolder && (
          <Button size="sm" variant="outline" onClick={() => setDelFolderOpen(true)} className="text-destructive">
            <Trash2 className="w-3.5 h-3.5 ms-1" /> {T("حذف فولدر", "Delete folder")}
          </Button>
        )}
      </div>

      

      {isFolder ? (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">📋 {T("لیست", "List")}</TabsTrigger>
            <TabsTrigger value="kanban">🗂 Kanban</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-4">{listView}</TabsContent>
          <TabsContent value="kanban" className="mt-4">
            <FolderKanban folderId={params.id!} onOpenTask={(id) => navigate(`/app/tasks/${id}`)} />
          </TabsContent>
        </Tabs>
      ) : (
        listView
      )}

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "task" ? T("حذف تسک؟", "Delete task?") : confirm?.kind === "note" ? T("حذف نوت؟", "Delete note?") : T("حذف زیرتسک؟", "Delete subtask?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {T(`آیا مطمئنی می‌خوای «${confirm?.title || T("این مورد", "this item")}» را حذف کنی؟`, `Are you sure you want to delete "${confirm?.title || T("این مورد", "this item")}"?`)}
              {confirm?.kind === "task" && (window as any).__lastChildCount > 0 && (
                <span className="block mt-2 text-destructive">⚠️ {T(`${(window as any).__lastChildCount} زیرتسک هم با این تسک حذف می‌شود.`, `${(window as any).__lastChildCount} subtask(s) will also be deleted.`)}</span>
              )}
              <span className="block mt-2 text-xs">{T("این عمل قابل بازگشت نیست.", "This action cannot be undone.")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T("انصراف", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirm) await confirm.onConfirm();
                setConfirm(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {T("حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {moveTask && (
        <MoveToDialog
          open={!!moveTask}
          onOpenChange={(v) => !v && setMoveTask(null)}
          kind="task"
          itemId={moveTask.id}
          currentFolderId={moveTask.folder_id}
          onMoved={() => { load(); setMoveTask(null); }}
        />
      )}

      {makeChildOf && (
        <MakeChildDialog
          open={!!makeChildOf}
          onOpenChange={(v) => !v && setMakeChildOf(null)}
          task={makeChildOf}
          allTasks={effectiveAllTasks}
          onDone={(newParentId) => {
            setAllTasks(prev => prev.map(x => x.id === makeChildOf!.id ? { ...x, parent_id: newParentId } : x));
            if (newParentId) setExpanded(s => ({ ...s, [newParentId]: true }));
          }}
        />
      )}

      {isFolder && delFolderOpen && (
        <FolderDeleteDialog
          open={delFolderOpen}
          onOpenChange={setDelFolderOpen}
          folderId={params.id!}
          folderName={folderName}
          onDone={() => { setDelFolderOpen(false); navigate("/app/inbox"); }}
        />
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          mode="drawer"
          onClose={() => setSelectedTask(null)}
          onChanged={load}
          setConfirm={setConfirm}
          allowDelete
        />
      )}

      <TaskActionSheet
        task={actionTask}
        onOpenChange={(v) => !v && setActionTask(null)}
        onComplete={() => actionTask && toggleTask(actionTask)}
        onDelete={() => actionTask && askDeleteTask(actionTask)}
        onMove={() => actionTask && setMoveTask(actionTask)}
        onMakeChild={() => actionTask && setMakeChildOf(actionTask)}
        onPatch={(patch) => actionTask && patchTask(actionTask.id, patch)}
        onPomodoro={() => actionTask && setPomoTask(actionTask)}
        onEdit={() => actionTask && setSelectedTask(actionTask)}
        onRefresh={load}
      />

      <PomodoroSheet
        task={pomoTask}
        open={!!pomoTask}
        onOpenChange={(v) => !v && setPomoTask(null)}
      />

      <OutcomePicker
        outcomes={outcomes}
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        onSelect={(outcome) => {
          setOutcomeOpen(false);
          if (outcomeTask) {
            if (outcome) completeTask(outcomeTask, outcome);
            else completeTask(outcomeTask);
          }
        }}
      />
    </div>
  );
}

