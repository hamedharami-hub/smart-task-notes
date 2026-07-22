import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Flag, Calendar, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useSensor, useSensors, useDroppable, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Col = { id: string; name: string; color: string | null; position: number };
type Task = {
  id: string; title: string; priority: Priority; due_date: string | null;
  completed: boolean; parent_id: string | null;
  kanban_column_id: string | null; folder_id: string | null;
};

const UNASSIGNED = "__unassigned__";

export function FolderKanban({ folderId, onOpenTask }: { folderId: string; onOpenTask?: (taskId: string) => void }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [cols, setCols] = useState<Col[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<Record<string, string>>({});
  const [newColName, setNewColName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [delCol, setDelCol] = useState<Col | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    if (!user) return;
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("folder_columns").select("*").eq("folder_id", folderId).order("position"),
      supabase.from("tasks").select("*").eq("folder_id", folderId).is("parent_id", null).order("position"),
    ]);
    setCols((c || []) as any);
    setTasks(((t || []) as unknown) as Task[]);
  };

  useEffect(() => { load(); }, [user, folderId]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`folder-kanban-${folderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `folder_id=eq.${folderId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "folder_columns", filter: `folder_id=eq.${folderId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, folderId]);

  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = { [UNASSIGNED]: [] };
    cols.forEach(c => { g[c.id] = []; });
    tasks.forEach(t => {
      const k = t.kanban_column_id && g[t.kanban_column_id] ? t.kanban_column_id : UNASSIGNED;
      g[k].push(t);
    });
    return g;
  }, [tasks, cols]);

  const addColumn = async () => {
    const name = newColName.trim();
    if (!name || !user) return;
    const { error } = await supabase.from("folder_columns").insert({
      user_id: user.id, folder_id: folderId, name, position: cols.length,
    });
    if (error) toast.error(error.message);
    else { setNewColName(""); toast.success(T("ستون اضافه شد", "Column added")); }
  };

  const renameColumn = async () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    const { error } = await supabase.from("folder_columns").update({ name }).eq("id", renaming.id);
    if (error) toast.error(error.message);
    else setRenaming(null);
  };

  const deleteColumn = async (col: Col) => {
    // Move tasks back to unassigned
    await supabase.from("tasks").update({ kanban_column_id: null } as any).eq("kanban_column_id", col.id);
    const { error } = await supabase.from("folder_columns").delete().eq("id", col.id);
    if (error) toast.error(error.message);
    else toast.success(T("ستون حذف شد", "Column deleted"));
  };

  const addCard = async (colId: string) => {
    const title = (newTitle[colId] || "").trim();
    if (!title || !user) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id, title, folder_id: folderId,
      kanban_column_id: colId === UNASSIGNED ? null : colId,
    } as any);
    if (error) return toast.error(error.message);
    setNewTitle(s => ({ ...s, [colId]: "" }));
  };

  const moveTask = async (taskId: string, targetColId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    const newKan = targetColId === UNASSIGNED ? null : targetColId;
    if (t.kanban_column_id === newKan) return;
    setTasks(prev => prev.map(x => x.id === taskId ? { ...x, kanban_column_id: newKan } : x));
    const { error } = await supabase.from("tasks").update({ kanban_column_id: newKan } as any).eq("id", taskId);
    if (error) toast.error(error.message);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    // Over can be column id (UNASSIGNED or col.id) OR another task id
    let targetCol: string | undefined;
    if (overIdStr === UNASSIGNED || cols.some(c => c.id === overIdStr)) {
      targetCol = overIdStr;
    } else {
      const overTask = tasks.find(t => t.id === overIdStr);
      if (overTask) targetCol = overTask.kanban_column_id || UNASSIGNED;
    }
    if (!targetCol) return;
    moveTask(activeIdStr, targetCol);
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const allColumns: Col[] = [
    { id: UNASSIGNED, name: T("بدون ستون", "No column"), color: "#94a3b8", position: -1 },
    ...cols,
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center bg-card/40 border rounded-lg p-2">
        <Input
          placeholder={T("+ نام ستون جدید (مثلاً «در حال طراحی»)", "+ New column name (e.g. In Progress)")}
          value={newColName}
          onChange={(e) => setNewColName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addColumn()}
          className="h-9"
        />
        <Button onClick={addColumn} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> {T("ستون", "Column")}
        </Button>
      </div>

      {cols.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground text-center">
          {T("هنوز ستون Kanban برای این فولدر تعریف نکردی. اول یک ستون اضافه کن.", "No Kanban columns for this folder yet. Add one first.")}
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {allColumns.map(col => (
            <Column
              key={col.id}
              col={col}
              tasks={grouped[col.id] || []}
              newValue={newTitle[col.id] || ""}
              setNewValue={(v) => setNewTitle(s => ({ ...s, [col.id]: v }))}
              onAdd={() => addCard(col.id)}
              onRename={col.id !== UNASSIGNED ? () => setRenaming({ id: col.id, name: col.name }) : undefined}
              onDelete={col.id !== UNASSIGNED ? () => setDelCol(col) : undefined}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Rename dialog */}
      <AlertDialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("تغییر نام ستون", "Rename column")}</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            value={renaming?.name || ""}
            onChange={(e) => setRenaming(r => r ? { ...r, name: e.target.value } : null)}
            onKeyDown={(e) => e.key === "Enter" && renameColumn()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{T("انصراف", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={renameColumn}>{T("ذخیره", "Save")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete column confirm */}
      <AlertDialog open={!!delCol} onOpenChange={(v) => !v && setDelCol(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T(`حذف ستون «${delCol?.name || T("این ستون", "this column")}»؟`, `Delete column "${delCol?.name || T("این ستون", "this column")}"?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {T("تسک‌های داخل این ستون به «بدون ستون» منتقل می‌شوند (حذف نمی‌شوند).", "Tasks in this column will be moved to No column (not deleted).")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T("انصراف", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (delCol) await deleteColumn(delCol); setDelCol(null); }}
            >
              {T("حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Column({
  col, tasks, newValue, setNewValue, onAdd, onRename, onDelete, onOpenTask,
}: {
  col: Col; tasks: Task[]; newValue: string;
  setNewValue: (v: string) => void; onAdd: () => void;
  onRename?: () => void; onDelete?: () => void;
  onOpenTask?: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const accent = col.color || "#3B82F6";
  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/30 rounded-xl border-t-4 p-3 min-w-[280px] max-w-[280px] transition ${isOver ? "bg-primary/5 ring-2 ring-primary/30" : ""}`}
      style={{ borderTopColor: accent }}
    >
      <div className="flex items-center justify-between mb-3 px-1 gap-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
          <h2 className="font-semibold text-sm truncate">{col.name}</h2>
          <Badge variant="secondary" className="text-[10px] shrink-0">{tasks.length}</Badge>
        </div>
        {onRename && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRename}>
            <Pencil className="w-3 h-3" />
          </Button>
        )}
        {onDelete && (
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-3">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder={T("+ کارت جدید", "+ New card")}
          className="h-8 text-xs bg-background"
        />
        <Button size="icon" variant="ghost" onClick={onAdd} className="h-8 w-8">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[40px]">
          {tasks.map(t => <SortableTaskCard key={t.id} task={t} onOpen={onOpenTask} />)}
          {tasks.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-4 border border-dashed rounded-lg">
              {T("اینجا رها کن", "Drop here")}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, onOpen }: { task: Task; onOpen?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard task={task} dragHandleProps={{ ...attributes, ...listeners }} onOpen={onOpen} />
    </div>
  );
}

function TaskCard({ task, dragging, dragHandleProps, onOpen }: {
  task: Task; dragging?: boolean;
  dragHandleProps?: any; onOpen?: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.none;
  return (
    <Card className={`p-2.5 border-s-4 ${pm.borderClass} ${dragging ? "shadow-lg" : "hover:shadow-soft"}`}>
      <div className="flex items-start gap-1.5">
        <button
          {...(dragHandleProps || {})}
          className="cursor-grab active:cursor-grabbing px-0.5 text-muted-foreground/60 hover:text-foreground touch-none shrink-0"
          aria-label={T("بکش برای جابجایی", "Drag to move")}
          title={T("بکش برای جابجایی", "Drag to move")}
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
        <button
          type="button"
          onClick={() => onOpen?.(task.id)}
          className="flex-1 min-w-0 text-end"
        >
          <p className={`text-xs font-medium hover:underline ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {task.priority !== "none" && (
              <Badge variant="outline" className={`text-[9px] gap-0.5 px-1.5 ${pm.bgClass} ${pm.textClass}`}>
                <Flag className="w-2 h-2" /> {T(pm.label, pm.labelEn)}
              </Badge>
            )}
            {task.due_date && (
              <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5">
                <Calendar className="w-2 h-2" />
                {format(new Date(task.due_date), "MMM d")}
              </Badge>
            )}
          </div>
        </button>
      </div>
    </Card>
  );
}
