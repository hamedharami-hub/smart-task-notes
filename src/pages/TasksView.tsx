import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { Plus, Calendar, Trash2, ChevronRight, ChevronDown, Flag, GripVertical, CornerDownRight, Ban } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { describeRule, nextOccurrence } from "@/lib/recurrence";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
  SortableTaskRow, RootDropZone,
} from "@/components/TaskDnDHelpers";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

import { TaskFilterSheet, DEFAULT_FILTERS, type TaskFilters, type SortLevel } from "@/components/TaskFilterSheet";
import { QuickAddTask } from "@/components/QuickAddTask";
import type { Task, ConfirmState } from "@/lib/taskTypes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SwipeableRow from "@/components/gestures/SwipeableRow";
import PullToRefresh from "@/components/gestures/PullToRefresh";
import TaskActionSheet from "@/components/TaskActionSheet";
import { useLongPress } from "@/lib/useLongPress";
import { DueDatePicker } from "@/components/DueDatePicker";
import { RecurrenceEditor } from "@/components/RecurrenceEditor";
import { MakeChildDialog } from "@/components/MakeChildDialog";
import { PRIORITY_SELECTABLE, type Priority } from "@/lib/priority";
import { Repeat } from "lucide-react";
import type { RecurrenceRule } from "@/lib/recurrence";

// Module-level cache shared across mounts: instantly hydrate from last fetch.
const tasksCache = new Map<string, Task[]>();


export default function TasksView({ scope }: { scope: "inbox" | "today" | "tomorrow" | "next7" | "smart" | "folder" | "tag" }) {
  const { user } = useAuth();
  const params = useParams();
  const [layout, setLayout] = useState<"compact" | "comfortable">("compact");
  useEffect(() => {
    if (!user) return;
    supabase.from("user_settings").select("task_card_layout").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.task_card_layout) setLayout(data.task_card_layout as any); });
  }, [user]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newTitle, setNewTitle] = useState("");
  // selected task removed — clicks navigate to /app/tasks/:id
  const [folderName, setFolderName] = useState("");
  const [tagName, setTagName] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [quickSub, setQuickSub] = useState<Record<string, string>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [makeChildOf, setMakeChildOf] = useState<Task | null>(null);
  const [delFolderOpen, setDelFolderOpen] = useState(false);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const navigate = useNavigate();

  // Patch a task field optimistically + persist
  const patchTask = async (id: string, patch: Partial<Task>) => {
    setAllTasks(prev => prev.map(x => x.id === id ? { ...x, ...patch } as Task : x));
    const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
    if (error) toast.error(error.message);
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
    } catch {}
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
    } catch {}
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

  const title = {
    inbox: "Inbox", today: "امروز", tomorrow: "فردا", next7: "۷ روز آینده",
    smart: "Smart Lists", folder: folderName || "فولدر", tag: `#${tagName || "تگ"}`,
  }[scope];

  // Build children map
  const childrenMap = useMemo(() => {
    const m: Record<string, Task[]> = {};
    allTasks.forEach(t => {
      if (t.parent_id) (m[t.parent_id] ||= []).push(t);
    });
    return m;
  }, [allTasks]);

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
      const { data: allData } = await supabase.from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("position").order("created_at", { ascending: false })
        .limit(2000);
      const all = ((allData || []) as unknown) as Task[];
      cache.set(user.id, all);
      setAllTasks(all);
    })();
    inflightRef.current = p;
    try { await p; } finally { inflightRef.current = null; }
  };

  const load = async () => {
    if (!user) return;
    // Serve cached list synchronously on mount/scope-switch — refetch in background
    const cached = cache.get(user.id);
    if (cached) setAllTasks(cached);
    await fetchAll(!cached);

    if (scope === "folder" && params.id) {
      const { data: f } = await supabase.from("folders").select("name").eq("id", params.id).single();
      if (f) setFolderName(f.name);
    } else if (scope === "tag" && params.id) {
      const { data: tg } = await supabase.from("tags").select("name").eq("id", params.id).single();
      if (tg) setTagName(tg.name);
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
    const ch = supabase.channel(`tasks-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "subtasks" }, scheduleLoad)
      .subscribe();
    return () => {
      if (pending != null) window.clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Keep cache in sync when optimistic local edits change the in-memory list
  useEffect(() => {
    if (user && allTasks.length) cache.set(user.id, allTasks);
  }, [allTasks, user]);

  // Filter top-level visible tasks per scope
  const topLevel = useMemo(() => {
    let list = allTasks.filter(t => !t.parent_id);
    if (scope === "inbox") list = list.filter(t => !t.folder_id);
    else if (scope === "today") {
      const s = startOfDay(new Date()).getTime(); const e = endOfDay(new Date()).getTime();
      list = list.filter(t => t.due_date && new Date(t.due_date).getTime() >= s && new Date(t.due_date).getTime() <= e);
    } else if (scope === "tomorrow") {
      const s = startOfDay(addDays(new Date(), 1)).getTime();
      const e = endOfDay(addDays(new Date(), 1)).getTime();
      list = list.filter(t => t.due_date && new Date(t.due_date).getTime() >= s && new Date(t.due_date).getTime() <= e);
    } else if (scope === "next7") {
      const s = startOfDay(new Date()).getTime(); const e = endOfDay(addDays(new Date(), 7)).getTime();
      list = list.filter(t => t.due_date && new Date(t.due_date).getTime() >= s && new Date(t.due_date).getTime() <= e);
    } else if (scope === "smart") {
      list = list.filter(t => t.priority === "high" && !t.completed);
    } else if (scope === "folder") {
      list = list.filter(t => t.folder_id === params.id);
    }

    // Apply advanced filters
    if (!filters.show_completed) list = list.filter(t => !t.completed);
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
    list = [...list].sort((a, b) => cmpForLevel(primary)(a, b) || cmpForLevel(secondary)(a, b));
    return list;
  }, [allTasks, scope, params.id, filters, taskTagsMap]);

  const addTask = async (parent_id: string | null = null) => {
    if (!newTitle.trim() || !user) return;
    const folder_id = scope === "folder" ? params.id || null : null;
    const due = scope === "today" ? new Date().toISOString()
      : scope === "tomorrow" ? addDays(new Date(), 1).toISOString()
      : scope === "next7" ? addDays(new Date(), 1).toISOString() : null;
    const { data, error } = await supabase.from("tasks").insert({
      user_id: user.id, title: newTitle, folder_id: parent_id ? null : folder_id,
      due_date: parent_id ? null : due, parent_id,
    }).select().single();
    if (error) toast.error(error.message);
    else {
      setNewTitle("");
      // optimistic update so user sees it immediately
      if (data) setAllTasks((prev) => [data as any, ...prev]);
      if (scope === "tag" && params.id && data && !parent_id) {
        await supabase.from("task_tags").insert({ task_id: data.id, tag_id: params.id, user_id: user.id });
      }
    }
  };

  const toggleTask = async (t: Task) => {
    const newCompleted = !t.completed;

    // Recurring task: instead of marking complete, roll forward to next occurrence
    if (newCompleted && t.recurrence_rule && user) {
      const now = new Date();
      let next = nextOccurrence(t.recurrence_rule, t.due_date ? new Date(t.due_date) : now);
      // Catch up: skip past missed occurrences until we reach one >= today
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
        setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x));
        await supabase.from("tasks").update(patch).eq("id", t.id);
        toast.success(`نمونه بعدی به ${format(next, "yyyy-MM-dd HH:mm")} منتقل شد 🔁`);
        return;
      }
    }

    setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, completed: newCompleted } : x));
    await supabase.from("tasks").update({
      completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null,
    }).eq("id", t.id);
  };

  const delTask = async (id: string) => {
    // snapshot task + descendants + tag links for undo
    const collectIds = (rid: string): string[] => {
      const out = [rid];
      const kids = allTasks.filter(t => t.parent_id === rid);
      kids.forEach(k => out.push(...collectIds(k.id)));
      return out;
    };
    const ids = collectIds(id);
    const snaps = allTasks.filter(t => ids.includes(t.id));
    const { data: tagLinks } = await supabase.from("task_tags").select("*").in("task_id", ids);
    setAllTasks(prev => prev.filter(t => !ids.includes(t.id)));
    await supabase.from("tasks").delete().eq("id", id);
    const title = snaps.find(s => s.id === id)?.title || "";
    const restore = async () => {
      await supabase.from("tasks").insert(snaps as any);
      if (tagLinks?.length) await supabase.from("task_tags").insert(tagLinks as any);
      load();
    };
    pushUndo({ label: `تسک «${title}» حذف شد`, undo: restore });
    pushDeleted({ kind: "task", label: title, restore });
  };

  const askDeleteTask = (t: Task) => {
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

  const quickAddSub = async (parent: Task, title: string) => {
    if (!title || !user) return;
    const { data, error } = await supabase.from("tasks").insert({
      user_id: user.id, title, parent_id: parent.id, priority: "none" as const,
    }).select().single();
    if (error) return toast.error(error.message);
    if (data) {
      setAllTasks(prev => [data as any, ...prev]);
      setExpanded(s => ({ ...s, [parent.id]: true }));
    }
  };


  // Drag & drop: drop a task onto another → set as child; drop in same parent zone → reorder
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over, delta } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = allTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Helper: when promoting a task to top-level, also fill scope-defining fields
    // so it doesn't disappear from the current view.
    const scopeRootPatch = (): Record<string, any> => {
      const patch: Record<string, any> = { parent_id: null };
      const today = startOfDay(new Date()).toISOString();
      const tomorrowIso = addDays(new Date(), 1).toISOString();
      if (scope === "today") patch.due_date = today;
      else if (scope === "tomorrow") patch.due_date = tomorrowIso;
      else if (scope === "next7" && !activeTask.due_date) patch.due_date = tomorrowIso;
      else if (scope === "folder") patch.folder_id = params.id || null;
      return patch;
    };

    if (overId.startsWith("child:")) {
      const newParent = overId.slice(6);
      if (newParent === activeId) return;
      // prevent cycles
      let p: string | null = newParent;
      while (p) {
        if (p === activeId) { toast.error("نمی‌توان داخل خودش انداخت"); return; }
        const pt = allTasks.find(x => x.id === p);
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
    const overTask = allTasks.find(t => t.id === overId);
    if (!overTask) return;

    // TickTick-style: if user dragged horizontally significantly, treat as INDENT
    // (make active a subtask of over) instead of reorder.
    const HORIZONTAL_INDENT = 40;
    if (delta && Math.abs(delta.x) > HORIZONTAL_INDENT && Math.abs(delta.x) > Math.abs(delta.y)) {
      // prevent cycles
      let p: string | null = overId;
      while (p) {
        if (p === activeId) { toast.error("نمی‌توان داخل خودش انداخت"); return; }
        const pt = allTasks.find(x => x.id === p);
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
    const parent = t.parent_id ? allTasks.find(x => x.id === t.parent_id) : null;
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
              disabled
              onComplete={() => toggleTask(t)}
              onDelete={() => askDeleteTask(t)}
              isCompleted={t.completed}
            >
            <Card className={`rounded-lg ${layout === "compact" ? "p-1.5" : "p-2"} border-s-[3px] ${pm.borderClass} ${t.is_avoidance ? "bg-amber-500/[0.04] border-amber-500/30" : ""} ${depth > 0 ? "bg-muted/20" : "bg-card/50"} hover:bg-accent/20 transition-colors`}>
              {depth > 0 && parent && (
                <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground/80">
                  <CornerDownRight className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">سطح {depth} · زیرِ «{parent.title}»</span>
                </div>
              )}
              {/* Row 1: chevron + TITLE (wide) + checkbox (right) */}
              <div dir="rtl" className="flex items-start gap-1.5">
                {subs.length > 0 ? (
                  <button onClick={() => setExpanded((s) => ({ ...s, [t.id]: !open }))} className="text-muted-foreground hover:text-foreground shrink-0 pt-0.5">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                ) : <span className="w-4 shrink-0" />}
                <div
                  className="flex-1 min-w-0 cursor-pointer select-none"
                  onClick={() => {
                    if (t.title.startsWith("چک‌این روزانه")) { navigate("/app/checkin"); return; }
                    navigate(`/app/tasks/${t.id}`);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    toggleTask(t);
                  }}
                >
                  <BidiText
                    as="p"
                    text={t.title}
                    className={`${layout === "compact" ? "text-sm" : "text-[15px]"} font-medium leading-tight break-words ${t.completed ? "line-through text-muted-foreground" : "text-foreground/90"}`}
                  />
                </div>
                {t.is_avoidance ? (
                  <button
                    onClick={() => toggleTask(t)}
                    title={t.completed ? "موفق به اجتناب — لغو" : "علامت بزن: موفق به اجتناب شدم"}
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
                <button {...dragHandle} data-drag-handle data-no-swipe-nav className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 h-5 w-5 rounded flex items-center justify-center" aria-label="drag" title="جابجایی">
                  <GripVertical className="w-3 h-3" />
                </button>
                {t.is_avoidance && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 h-4 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <Ban className="w-2.5 h-2.5" /> اجتنابی
                  </span>
                )}
                {t.priority !== "none" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={`text-[10px] gap-0.5 px-1.5 py-0 h-[18px] inline-flex items-center rounded border ${pm.bgClass} ${pm.textClass}`}
                        title="تغییر اولویت"
                      >
                        <Flag className="w-2.5 h-2.5" /> {pm.label}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                      {PRIORITY_SELECTABLE.map(p => {
                        const m = PRIORITY_META[p];
                        return (
                          <button key={p}
                            onClick={() => patchTask(t.id, { priority: p as Priority })}
                            className={`w-full text-start px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 ${t.priority === p ? "bg-accent" : ""}`}>
                            <Flag className={`w-3 h-3 ${m.textClass}`} /> {m.label}
                          </button>
                        );
                      })}
                      {t.priority !== "none" && (
                        <button onClick={() => patchTask(t.id, { priority: "none" as Priority })}
                          className="w-full text-start px-2 py-1.5 text-xs rounded hover:bg-accent text-muted-foreground border-t mt-1">
                          حذف اولویت
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
                        title="تغییر تاریخ"
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
                        title="تغییر تکرار"
                      >
                        <Repeat className="w-2.5 h-2.5" /> {describeRule(t.recurrence_rule)}
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
              </div>
            </Card>
            </SwipeableRow>
          )}
        </SortableTaskRow>
        {open && subs.length > 0 && (
          <div className="mt-1 space-y-1">
            <SortableContext items={subs.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {subs.map((s) => <TaskItem key={s.id} t={s} depth={depth + 1} />)}
            </SortableContext>
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <RootDropZone />
        <div className="space-y-1 mt-1">
          {topLevel.length === 0 && (
            <Card className="p-5 text-center text-muted-foreground text-sm border-dashed">هیچ تسکی نیست</Card>
          )}
          <SortableContext items={topLevel.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {topLevel.map((t) => <TaskItem key={t.id} t={t} />)}
          </SortableContext>
        </div>
        <DragOverlay>
          {activeDragId ? (
            <Card className="p-3 shadow-lg opacity-90">
              <p className="text-sm font-medium">
                {allTasks.find(x => x.id === activeDragId)?.title || "..."}
              </p>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </PullToRefresh>
  );

  return (
    <div className="p-2 sm:p-3 md:p-4 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <BidiText as="h1" text={title} className="text-xl md:text-2xl font-bold" />
        {isFolder && (
          <Button size="sm" variant="outline" onClick={() => setDelFolderOpen(true)} className="text-destructive">
            <Trash2 className="w-3.5 h-3.5 ms-1" /> حذف فولدر
          </Button>
        )}
      </div>

      

      {isFolder ? (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">📋 لیست</TabsTrigger>
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
              {confirm?.kind === "task" ? "حذف تسک؟" : confirm?.kind === "note" ? "حذف نوت؟" : "حذف زیرتسک؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئنی می‌خوای «{confirm?.title}» را حذف کنی؟
              {confirm?.kind === "task" && (window as any).__lastChildCount > 0 && (
                <span className="block mt-2 text-destructive">⚠️ {(window as any).__lastChildCount} زیرتسک هم با این تسک حذف می‌شود.</span>
              )}
              <span className="block mt-2 text-xs">این عمل قابل بازگشت نیست.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirm) await confirm.onConfirm();
                setConfirm(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
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
          allTasks={allTasks}
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

      <TaskActionSheet
        task={actionTask}
        onOpenChange={(v) => !v && setActionTask(null)}
        onComplete={() => actionTask && toggleTask(actionTask)}
        onDelete={() => actionTask && askDeleteTask(actionTask)}
        onMove={() => actionTask && setMoveTask(actionTask)}
        onMakeChild={() => actionTask && setMakeChildOf(actionTask)}
        onEdit={() => actionTask && navigate(`/app/tasks/${actionTask.id}`)}
      />
    </div>
  );
}

