import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Flag, Calendar, Circle, Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { haptic } from "@/lib/haptics";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDroppable, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Status = "todo" | "in_progress" | "done";
type Task = {
  id: string; title: string; priority: Priority; due_date: string | null;
  status: Status; completed: boolean; parent_id: string | null;
};

const COLUMNS: { id: Status; labelFa: string; labelEn: string; icon: any; accent: string }[] = [
  { id: "todo", labelFa: "برای انجام", labelEn: "To Do", icon: Circle, accent: "border-t-muted-foreground/40" },
  { id: "in_progress", labelFa: "در حال انجام", labelEn: "In Progress", icon: Loader2, accent: "border-t-primary" },
  { id: "done", labelFa: "انجام شده", labelEn: "Done", icon: CheckCircle2, accent: "border-t-emerald-500" },
];
const COL_ORDER: Status[] = ["todo", "in_progress", "done"];

export default function KanbanView() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<Record<Status, string>>({ todo: "", in_progress: "", done: "" });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").is("parent_id", null).order("position");
    setTasks(((data || []) as unknown) as Task[]);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`kanban-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    tasks.forEach(t => { (g[t.status] ||= []).push(t); });
    return g;
  }, [tasks]);

  const addCard = async (status: Status) => {
    const title = newTitle[status].trim();
    if (!title || !user) return;
    const completed = status === "done";
    const { data, error } = await supabase.from("tasks").insert({
      user_id: user.id, title, status, completed,
      completed_at: completed ? new Date().toISOString() : null,
    }).select().single();
    if (error) return toast.error(error.message);
    if (data) setTasks(prev => [...prev, data as any]);
    setNewTitle(s => ({ ...s, [status]: "" }));
  };

  const moveTask = async (taskId: string, newStatus: Status) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t || t.status === newStatus) return;
    const completed = newStatus === "done";
    setTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: newStatus, completed } : x));
    const { error } = await supabase.from("tasks").update({
      status: newStatus, completed,
      completed_at: completed ? new Date().toISOString() : null,
    } as any).eq("id", taskId);
    if (error) toast.error(error.message);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    // over can be column id or another task id
    const targetCol: Status | undefined =
      (COLUMNS.find(c => c.id === overIdStr)?.id) ||
      tasks.find(t => t.id === overIdStr)?.status;
    if (!targetCol) return;
    moveTask(activeIdStr, targetCol);
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div dir="rtl" className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Kanban</h1>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={grouped[col.id]}
              newValue={newTitle[col.id]}
              setNewValue={(v) => setNewTitle(s => ({ ...s, [col.id]: v }))}
              onAdd={() => addCard(col.id)}
              onMove={moveTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  column, tasks, newValue, setNewValue, onAdd, onMove,
}: {
  column: typeof COLUMNS[number];
  tasks: Task[];
  newValue: string;
  setNewValue: (v: string) => void;
  onAdd: () => void;
  onMove: (taskId: string, newStatus: Status) => void;
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
      className={`bg-muted/30 rounded-xl border-t-4 ${column.accent} p-3 min-h-[400px] transition ${isOver ? "bg-primary/5 ring-2 ring-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${column.id === "in_progress" ? "animate-spin" : ""}`} />
          <h2 className="font-semibold">{T(column.labelFa, column.labelEn)}</h2>
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder={T("+ کارت جدید", "+ New card")}
          className="h-8 text-sm bg-background"
        />
        <Button size="icon" variant="ghost" onClick={onAdd} className="h-8 w-8">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map(t => (
            <SortableTaskCard
              key={t.id}
              task={t}
              prevCol={prevCol}
              nextCol={nextCol}
              onMove={onMove}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">
              {T("اینجا رها کن", "Drop here")}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, prevCol, nextCol, onMove }: {
  task: Task; prevCol?: Status; nextCol?: Status; onMove: (taskId: string, newStatus: Status) => void;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const navigate = useNavigate();
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  // Horizontal swipe: in RTL the visual "next column" is to the LEFT.
  const startX = useRef(0);
  const startY = useRef(0);
  const dxRef = useRef(0);
  const tracking = useRef(false);
  const [dx, setDx] = useState(0);
  const THRESHOLD = 70;

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    dxRef.current = 0;
    tracking.current = true;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!tracking.current) return;
    const t = e.touches[0];
    const dxNow = t.clientX - startX.current;
    const dyNow = Math.abs(t.clientY - startY.current);
    if (dyNow > 24 && Math.abs(dxNow) < 24) { tracking.current = false; setDx(0); return; }
    dxRef.current = dxNow;
    setDx(Math.max(-120, Math.min(120, dxNow)));
  };
  const onTouchEnd = () => {
    if (!tracking.current) { setDx(0); return; }
    tracking.current = false;
    const d = dxRef.current;
    setDx(0);
    if (Math.abs(d) < THRESHOLD) return;
    // RTL: dx<0 (swipe left) → next column; dx>0 (swipe right) → prev column
    if (d < 0 && nextCol) { haptic("success"); onMove(task.id, nextCol); }
    else if (d > 0 && prevCol) { haptic("success"); onMove(task.id, prevCol); }
  };

  const showNext = dx < -10 && nextCol;
  const showPrev = dx > 10 && prevCol;
  const reachedThreshold = Math.abs(dx) >= THRESHOLD;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Underlay hint */}
      {(showNext || showPrev) && (
        <div className={`absolute inset-0 rounded-lg flex items-center px-3 text-[11px] font-medium pointer-events-none ${
          reachedThreshold ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        } ${showNext ? "justify-start" : "justify-end"}`}>
          {showNext ? (() => { const c = COLUMNS.find(c => c.id === nextCol); return <><ArrowLeft className="w-3.5 h-3.5 me-1" />{c ? T(c.labelFa, c.labelEn) : ""}</>; })()
                    : (() => { const c = COLUMNS.find(c => c.id === prevCol); return <>{c ? T(c.labelFa, c.labelEn) : ""}<ArrowRight className="w-3.5 h-3.5 ms-1" /></>; })()}
        </div>
      )}
      <div
        style={{ transform: `translateX(${dx}px)`, transition: tracking.current ? "none" : "transform 180ms" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { tracking.current = false; setDx(0); }}
      >
        <TaskCard
          task={task}
          dragHandleProps={{ ...attributes, ...listeners }}
          onOpen={() => navigate(`/app/tasks/${task.id}`)}
        />
      </div>
    </div>
  );
}

function TaskCard({ task, dragging, dragHandleProps, onOpen }: {
  task: Task; dragging?: boolean; dragHandleProps?: any; onOpen?: () => void;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.none;
  return (
    <Card className={`p-3 border-s-4 ${pm.borderClass} ${dragging ? "shadow-lg" : "hover:shadow-soft"}`}>
      <div className="flex items-start gap-1.5">
        <button
          {...(dragHandleProps || {})}
          className="cursor-grab active:cursor-grabbing px-0.5 text-muted-foreground/60 hover:text-foreground touch-none shrink-0"
          aria-label="drag"
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-end">
          <p className={`text-sm font-medium hover:underline ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {task.priority !== "none" && (
              <Badge variant="outline" className={`text-[10px] gap-1 ${pm.bgClass} ${pm.textClass}`}>
                <Flag className="w-2.5 h-2.5" /> {T(pm.label, pm.labelEn)}
              </Badge>
            )}
            {task.due_date && (
              <Badge variant="secondary" className="text-[10px] gap-1">
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
