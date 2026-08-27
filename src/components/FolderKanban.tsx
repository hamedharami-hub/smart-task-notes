import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Flag,
  Calendar,
  Circle,
  Loader2,
  CheckCircle2,
  MoreVertical,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Edit2,
  FolderTree,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { haptic } from "@/lib/haptics";
import { awardWaterDrops } from "@/lib/garden";
import {
  type GoalKanban,
  type TimeHorizon,
  type GoalPriority,
  getKanbanGoals,
  saveKanbanGoals,
  getGoalById,
  generateUUID,
  isValidUUID,
  TIME_HORIZONS,
} from "@/lib/kanbanGoals";
import MultiTierTabs from "@/components/kanban/MultiTierTabs";
import GoalEditorModal from "@/components/kanban/GoalEditorModal";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Status = "todo" | "in_progress" | "done";
type Task = {
  id: string;
  title: string;
  priority: Priority;
  due_date: string | null;
  status: Status;
  completed: boolean;
  parent_id: string | null;
  folder_id?: string | null;
  kanban_column_id?: string | null;
};

const COLUMNS: { id: Status; labelFa: string; labelEn: string; icon: any; accent: string }[] = [
  { id: "todo", labelFa: "برای انجام", labelEn: "To Do", icon: Circle, accent: "border-t-muted-foreground/40" },
  { id: "in_progress", labelFa: "در حال انجام", labelEn: "In Progress", icon: Loader2, accent: "border-t-primary" },
  { id: "done", labelFa: "انجام شده", labelEn: "Done", icon: CheckCircle2, accent: "border-t-emerald-500" },
];
const COL_ORDER: Status[] = ["todo", "in_progress", "done"];

export function FolderKanban({
  folderId,
  onOpenTask,
}: {
  folderId: string;
  onOpenTask?: (taskId: string) => void;
}) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  // --- GOAL STATE FOR THIS FOLDER ---
  const [goals, setGoals] = useState<GoalKanban[]>(() => getKanbanGoals(folderId, user?.id));
  const [selectedTier1Id, setSelectedTier1Id] = useState<string | null>(() => goals[0]?.id || null);
  const [selectedTier2Id, setSelectedTier2Id] = useState<string | null>(null);
  const [selectedTier3Id, setSelectedTier3Id] = useState<string | null>(null);

  // Mode and Layout
  const [viewMode, setViewMode] = useState<"hierarchy" | "time" | "priority">("hierarchy");
  const [layoutMode, setLayoutMode] = useState<"stream" | "columns">("stream");
  const [timeFilter, setTimeFilter] = useState<TimeHorizon | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<GoalPriority | "all">("all");

  // Goal Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalKanban | null>(null);
  const [newGoalParentId, setNewGoalParentId] = useState<string | null>(null);

  // --- TASK STATE FOR THIS FOLDER ---
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [quickColumnTitle, setQuickColumnTitle] = useState<Record<Status, string>>({
    todo: "",
    in_progress: "",
    done: "",
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Synchronize folder goals
  useEffect(() => {
    const list = getKanbanGoals(folderId, user?.id);
    setGoals(list);
    if (!selectedTier1Id && list.length > 0) {
      setSelectedTier1Id(list[0].id);
    }
  }, [folderId, user]);

  // Load tasks belonging to this folder
  const loadTasks = async () => {
    if (!user || !folderId) return;
    const [parentsRes, subsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("folder_id", folderId).is("parent_id", null).order("position"),
      supabase.from("tasks").select("*").eq("folder_id", folderId).not("parent_id", "is", null).order("position"),
    ]);
    setAllTasks(((parentsRes.data || []) as unknown) as Task[]);
    setSubtasks(((subsRes.data || []) as unknown) as Task[]);
  };

  useEffect(() => {
    loadTasks();
  }, [user, folderId]);

  useEffect(() => {
    if (!user || !folderId) return;
    const ch = supabase
      .channel(`folder-kanban-goals-${folderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `folder_id=eq.${folderId}` }, loadTasks)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, folderId]);

  // Identify Active Goal (Tier 3 > Tier 2 > Tier 1)
  const activeGoalId = selectedTier3Id || selectedTier2Id || selectedTier1Id;
  const activeGoal = useMemo(() => {
    if (!activeGoalId) return goals[0] || null;
    return getGoalById(goals, activeGoalId) || goals[0] || null;
  }, [goals, activeGoalId]);

  // Task Counts per Goal (for badge indicators)
  const taskCountsByGoal = useMemo(() => {
    const map: Record<string, number> = {};
    allTasks.forEach((t) => {
      const gid = t.kanban_column_id;
      if (gid) map[gid] = (map[gid] || 0) + 1;
    });
    return map;
  }, [allTasks]);

  // Filtered tasks for current active goal in this folder
  const currentGoalTasks = useMemo(() => {
    if (!activeGoalId) return allTasks;
    const direct = allTasks.filter((t) => t.kanban_column_id === activeGoalId);
    // If no direct matches and on root goal with "Not Sectioned" selected, show unassigned tasks in this folder
    if (direct.length === 0 && selectedTier2Id === null) {
      return allTasks.filter((t) => !t.kanban_column_id);
    }
    return direct;
  }, [allTasks, activeGoalId, selectedTier2Id]);

  const incompleteTasks = useMemo(() => currentGoalTasks.filter((t) => !t.completed), [currentGoalTasks]);
  const completedTasks = useMemo(() => currentGoalTasks.filter((t) => t.completed), [currentGoalTasks]);

  // Task mutations
  const toggleTask = async (task: Task) => {
    haptic("light");
    const newCompleted = !task.completed;
    const newStatus: Status = newCompleted ? "done" : "todo";
    setAllTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: newCompleted, status: newStatus } : t))
    );
    if (newCompleted) awardWaterDrops(10, "تکمیل تسک");
    const { error } = await supabase
      .from("tasks")
      .update({
        completed: newCompleted,
        status: newStatus,
        completed_at: newCompleted ? new Date().toISOString() : null,
      } as any)
      .eq("id", task.id);
    if (error) toast.error(error.message);
  };

  const addQuickTask = async (title: string, status: Status = "todo") => {
    if (!title.trim() || !user) return;
    const completed = status === "done";
    const validColumnId = isValidUUID(activeGoalId) ? activeGoalId : null;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        folder_id: folderId,
        title: title.trim(),
        status,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        kanban_column_id: validColumnId,
      } as any)
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (data) setAllTasks((prev) => [...prev, data as any]);
    setQuickTitle("");
    toast.success("تسک جدید افزوده شد");
  };

  const moveTaskColumn = async (taskId: string, newStatus: Status) => {
    const t = allTasks.find((x) => x.id === taskId);
    if (!t || t.status === newStatus) return;
    const completed = newStatus === "done";
    setAllTasks((prev) =>
      prev.map((x) => (x.id === taskId ? { ...x, status: newStatus, completed } : x))
    );
    if (newStatus === "done" && t.status !== "done") awardWaterDrops(10, "تکمیل تسک");
    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      } as any)
      .eq("id", taskId);
    if (error) toast.error(error.message);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const targetCol: Status | undefined =
      COLUMNS.find((c) => c.id === overIdStr)?.id ||
      allTasks.find((t) => t.id === overIdStr)?.status;
    if (!targetCol) return;
    moveTaskColumn(activeIdStr, targetCol);
  };

  // Goal management
  const handleSaveGoal = (goalData: Partial<GoalKanban>) => {
    let nextGoals: GoalKanban[];
    if (goalData.id) {
      nextGoals = goals.map((g) =>
        g.id === goalData.id
          ? ({ ...g, ...goalData, updatedAt: new Date().toISOString() } as GoalKanban)
          : g
      );
      toast.success("هدف با موفقیت بروزرسانی شد");
    } else {
      const newG: GoalKanban = {
        id: generateUUID(),
        title: goalData.title || "هدف جدید",
        description: goalData.description,
        parentId: goalData.parentId || null,
        timeHorizon: goalData.timeHorizon || "monthly",
        priority: goalData.priority || "medium",
        color: goalData.color || "#3b82f6",
        icon: goalData.icon || "🎯",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      nextGoals = [...goals, newG];
      if (!newG.parentId) {
        setSelectedTier1Id(newG.id);
      } else {
        setSelectedTier2Id(newG.id);
      }
      toast.success("هدف جدید در این فولدر ایجاد شد");
    }
    setGoals(nextGoals);
    saveKanbanGoals(nextGoals, folderId, user?.id);
  };

  const handleDeleteGoal = (goalId: string) => {
    const deletedIds = new Set([goalId]);
    let changed = true;
    while (changed) {
      changed = false;
      goals.forEach((g) => {
        if (g.parentId && deletedIds.has(g.parentId) && !deletedIds.has(g.id)) {
          deletedIds.add(g.id);
          changed = true;
        }
      });
    }
    const next = goals.filter((g) => !deletedIds.has(g.id));
    setGoals(next);
    saveKanbanGoals(next, folderId, user?.id);
    if (selectedTier1Id && deletedIds.has(selectedTier1Id)) {
      setSelectedTier1Id(next.find((g) => g.parentId === null)?.id || null);
    }
    if (selectedTier2Id && deletedIds.has(selectedTier2Id)) setSelectedTier2Id(null);
    if (selectedTier3Id && deletedIds.has(selectedTier3Id)) setSelectedTier3Id(null);
    toast.success("هدف با موفقیت حذف شد");
  };

  const openEditForGoal = (g: GoalKanban) => {
    setEditingGoal(g);
    setNewGoalParentId(null);
    setEditorOpen(true);
  };

  const openAddNewGoal = (parentId: string | null = null) => {
    setEditingGoal(null);
    setNewGoalParentId(parentId);
    setEditorOpen(true);
  };

  const activeTaskObj = activeId ? allTasks.find((t) => t.id === activeId) : null;

  return (
    <div dir="rtl" className="space-y-4 pb-20 animate-fade-in relative">
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-card/60 border border-border/70 p-3 rounded-2xl backdrop-blur">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onDoubleClick={() => activeGoal && openEditForGoal(activeGoal)}
            className="flex items-center gap-2 text-lg md:text-xl font-black text-foreground hover:text-primary transition-colors text-start"
            title="دوبار کلیک یا تاچ برای ویرایش این هدف"
          >
            <span>{activeGoal?.icon || "🎯"}</span>
            <span>{activeGoal?.title || "هدف انتخابی"}</span>
          </button>

          {activeGoal && (
            <Badge variant="outline" className="text-[11px] font-mono gap-1 border-primary/30 text-primary">
              <span>{TIME_HORIZONS.find((th) => th.id === activeGoal.timeHorizon)?.labelFa || "ماهانه"}</span>
            </Badge>
          )}
        </div>

        {/* Actions & Sorting */}
        <div className="flex items-center gap-1.5">
          {/* Layout Mode Toggle */}
          <div className="flex rounded-xl bg-muted/60 p-0.5 border">
            <button
              type="button"
              onClick={() => setLayoutMode("stream")}
              className={`p-1.5 rounded-lg text-xs transition ${
                layoutMode === "stream" ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground"
              }`}
              title="نمای استریم تمام‌صفحه"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("columns")}
              className={`p-1.5 rounded-lg text-xs transition ${
                layoutMode === "columns" ? "bg-background shadow-xs text-primary font-bold" : "text-muted-foreground"
              }`}
              title="ستون‌های کلاسیک کانبان"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Grouping / Filter Mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1.5 bg-card/60">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {viewMode === "hierarchy" ? "ساختار درختی" : viewMode === "time" ? "بر اساس زمان" : "بر اساس اهمیت"}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs w-48">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">حالت نمایش کانبان این فولدر</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setViewMode("hierarchy")} className="gap-2 font-medium">
                <FolderTree className="w-3.5 h-3.5 text-primary" /> ساختار درختی و چندسطحی
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("time")} className="gap-2 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> مرتب‌سازی بر اساس زمان (افق)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode("priority")} className="gap-2 font-medium">
                <Flag className="w-3.5 h-3.5 text-rose-500" /> مرتب‌سازی بر اساس اهمیت
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => activeGoal && openEditForGoal(activeGoal)} className="gap-2">
                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" /> ویرایش هدف فعلی
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAddNewGoal(null)} className="gap-2">
                <Plus className="w-3.5 h-3.5 text-emerald-500" /> ایجاد هدف جدید در این فولدر
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs w-44">
              {activeGoal && (
                <>
                  <DropdownMenuItem onClick={() => openEditForGoal(activeGoal)} className="gap-2">
                    <Edit2 className="w-3.5 h-3.5" /> ویرایش تنظیمات این هدف
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openAddNewGoal(activeGoal.id)} className="gap-2">
                    <Plus className="w-3.5 h-3.5 text-primary" /> افزودن زیرمجموعه
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteGoal(activeGoal.id)}
                    className="gap-2 text-destructive focus:bg-destructive/10"
                  >
                    حذف این هدف
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. MULTI-TIER HORIZONTAL TABS */}
      <Card className="p-3 rounded-2xl bg-card/60 border border-border/70 backdrop-blur shadow-xs">
        <MultiTierTabs
          goals={goals}
          selectedTier1Id={selectedTier1Id}
          selectedTier2Id={selectedTier2Id}
          selectedTier3Id={selectedTier3Id}
          viewMode={viewMode}
          selectedTimeFilter={timeFilter}
          selectedPriorityFilter={priorityFilter}
          onSelectTier1={(id) => setSelectedTier1Id(id)}
          onSelectTier2={(id) => setSelectedTier2Id(id)}
          onSelectTier3={(id) => setSelectedTier3Id(id)}
          onSelectTimeFilter={(h) => setTimeFilter(h)}
          onSelectPriorityFilter={(p) => setPriorityFilter(p)}
          onDoubleTapGoal={openEditForGoal}
          onAddNewGoal={openAddNewGoal}
          taskCountsByGoal={taskCountsByGoal}
        />
      </Card>

      {/* 3. MAIN CONTENT: STREAM VIEW OR CLASSIC KANBAN */}
      {layoutMode === "stream" ? (
        <div className="space-y-4">
          {/* Quick Input Bar */}
          <div className="flex gap-2">
            <Input
              ref={quickInputRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuickTask(quickTitle)}
              placeholder={`+ افزودن تسک جدید به «${activeGoal?.title || "این بخش"}»...`}
              className="bg-card/70 border-border/70 text-sm h-11 rounded-2xl shadow-xs"
            />
            <Button
              onClick={() => addQuickTask(quickTitle)}
              disabled={!quickTitle.trim()}
              className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Incomplete Task Cards */}
          <div className="space-y-3">
            {incompleteTasks.map((t) => {
              const taskSubs = subtasks.filter((s) => s.parent_id === t.id);
              const pm = PRIORITY_META[t.priority] || PRIORITY_META.none;
              return (
                <Card
                  key={t.id}
                  className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/40 transition-all space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTask(t)}
                      className="mt-0.5 w-5 h-5 rounded-md border-2 border-rose-500/80 hover:bg-rose-500/10 flex items-center justify-center transition shrink-0"
                    >
                      {t.completed && <Check className="w-3.5 h-3.5 text-rose-500" />}
                    </button>

                    <div
                      onClick={() => onOpenTask?.(t.id)}
                      className="flex-1 min-w-0 cursor-pointer text-start"
                    >
                      <h4 className="text-[15px] font-bold text-foreground hover:text-primary transition-colors leading-snug">
                        {t.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {t.priority !== "none" && (
                          <Badge variant="outline" className={`text-[10px] gap-1 ${pm.bgClass} ${pm.textClass}`}>
                            <Flag className="w-2.5 h-2.5" /> {T(pm.label, pm.labelEn)}
                          </Badge>
                        )}
                        {t.due_date && (
                          <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {format(new Date(t.due_date), "MMM d")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subtasks inside card */}
                  {taskSubs.length > 0 && (
                    <div className="pe-2 ps-6 space-y-2 border-t border-border/40 pt-2.5">
                      {taskSubs.map((st) => (
                        <div key={st.id} className="flex items-center gap-2.5 text-xs text-foreground/90">
                          <Checkbox
                            checked={st.completed}
                            onCheckedChange={() => toggleTask(st)}
                            className="w-4 h-4 rounded"
                          />
                          <span
                            onClick={() => onOpenTask?.(st.id)}
                            className={`cursor-pointer hover:underline ${
                              st.completed ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {st.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            {incompleteTasks.length === 0 && (
              <div className="text-center py-10 border border-dashed rounded-3xl bg-muted/20 space-y-2">
                <div className="text-2xl">✨</div>
                <h4 className="text-sm font-bold text-foreground">همه تسک‌های این هدف انجام شده‌اند!</h4>
                <p className="text-xs text-muted-foreground">می‌توانید تسک جدیدی برای ادامه کارها بیفزایید.</p>
              </div>
            )}
          </div>

          {/* Completed Collapsible Section */}
          {completedTasks.length > 0 && (
            <div className="pt-3 space-y-2">
              <button
                type="button"
                onClick={() => setCompletedOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                <span>Completed</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full">
                  {completedTasks.length}
                </Badge>
                {completedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {completedOpen && (
                <div className="space-y-2 animate-fade-in">
                  {completedTasks.map((ct) => (
                    <Card
                      key={ct.id}
                      className="p-3.5 rounded-2xl bg-card/40 border border-border/50 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Checkbox checked={true} onCheckedChange={() => toggleTask(ct)} className="rounded" />
                        <span
                          onClick={() => onOpenTask?.(ct.id)}
                          className="text-xs line-through text-muted-foreground truncate cursor-pointer hover:underline"
                        >
                          {ct.title}
                        </span>
                      </div>
                      {ct.due_date && (
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {format(new Date(ct.due_date), "d MMM")}
                        </span>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Classic 3-Column Kanban Board */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = currentGoalTasks.filter((t) => t.status === col.id);
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={colTasks}
                  newValue={quickColumnTitle[col.id]}
                  setNewValue={(v) => setQuickColumnTitle((s) => ({ ...s, [col.id]: v }))}
                  onAdd={() => {
                    addQuickTask(quickColumnTitle[col.id], col.id);
                    setQuickColumnTitle((s) => ({ ...s, [col.id]: "" }));
                  }}
                  onMove={moveTaskColumn}
                  onOpenTask={onOpenTask}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeTaskObj ? <TaskCard task={activeTaskObj} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Floating Action Button (+) matching screenshot bottom right */}
      <button
        type="button"
        onClick={() => {
          if (quickTitle.trim()) addQuickTask(quickTitle);
          else quickInputRef.current?.focus();
        }}
        className="fixed bottom-6 start-6 md:bottom-8 md:start-8 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-blue-500/30 transition-transform z-30"
        title="افزودن تسک سریع"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* Goal Editor & Settings Modal */}
      <GoalEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        goal={editingGoal}
        allGoals={goals}
        defaultParentId={newGoalParentId}
        onSave={handleSaveGoal}
        onDelete={handleDeleteGoal}
      />
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  newValue,
  setNewValue,
  onAdd,
  onMove,
  onOpenTask,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  newValue: string;
  setNewValue: (v: string) => void;
  onAdd: () => void;
  onMove: (taskId: string, newStatus: Status) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.icon;
  const colIdx = COL_ORDER.indexOf(column.id);
  const prevCol = COL_ORDER[colIdx - 1];
  const nextCol = COL_ORDER[colIdx + 1];

  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/30 rounded-2xl border-t-4 ${column.accent} p-3 min-h-[400px] transition ${
        isOver ? "bg-primary/5 ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${column.id === "in_progress" ? "animate-spin" : ""}`} />
          <h2 className="font-semibold text-sm">{T(column.labelFa, column.labelEn)}</h2>
          <Badge variant="secondary" className="text-xs font-mono">
            {tasks.length}
          </Badge>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder={T("+ کارت جدید", "+ New card")}
          className="h-8 text-xs bg-background rounded-xl"
        />
        <Button size="icon" variant="ghost" onClick={onAdd} className="h-8 w-8 rounded-xl">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              prevCol={prevCol}
              nextCol={nextCol}
              onMove={onMove}
              onOpenTask={onOpenTask}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-xl">
              {T("اینجا رها کن", "Drop here")}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({
  task,
  prevCol,
  nextCol,
  onMove,
  onOpenTask,
}: {
  task: Task;
  prevCol?: Status;
  nextCol?: Status;
  onMove: (taskId: string, newStatus: Status) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        dragHandleProps={{ ...attributes, ...listeners }}
        onOpen={() => onOpenTask?.(task.id)}
      />
    </div>
  );
}

function TaskCard({
  task,
  dragging,
  dragHandleProps,
  onOpen,
}: {
  task: Task;
  dragging?: boolean;
  dragHandleProps?: any;
  onOpen?: () => void;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.none;

  return (
    <Card className={`p-3 border-s-4 ${pm.borderClass} ${dragging ? "shadow-lg" : "hover:shadow-xs"}`}>
      <div className="flex items-start gap-1.5">
        <button
          {...(dragHandleProps || {})}
          className="cursor-grab active:cursor-grabbing px-0.5 text-muted-foreground/60 hover:text-foreground touch-none shrink-0"
          aria-label="drag"
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-start">
          <p
            className={`text-sm font-medium hover:underline ${
              task.completed ? "line-through text-muted-foreground" : ""
            }`}
          >
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {task.priority !== "none" && (
              <Badge variant="outline" className={`text-[10px] gap-1 ${pm.bgClass} ${pm.textClass}`}>
                <Flag className="w-2.5 h-2.5" /> {T(pm.label, pm.labelEn)}
              </Badge>
            )}
            {task.due_date && (
              <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
                <Calendar className="w-2.5 h-2.5" />
                {format(new Date(task.due_date), "MMM d")}
              </Badge>
            )}
          </div>
        </button>
      </div>
    </Card>
  );
}
