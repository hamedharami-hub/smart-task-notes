import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ListTree, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { BidiText } from "@/components/BidiText";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Sub = {
  id: string; title: string; completed: boolean; position: number;
};

export function TaskSubtasksInline({
  taskId, onOpenSubtask, readOnly = false,
}: {
  taskId: string;
  onOpenSubtask?: (id: string) => void;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const editingRef = useRef<Set<string>>(new Set());
  const writeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id,title,completed,position")
      .eq("parent_id", taskId)
      .order("position")
      .order("created_at", { ascending: true });
    // Preserve titles for rows the user is actively editing (avoid clobbering input/focus on mobile)
    setSubs((prev) => {
      const prevMap = new Map(prev.map((p) => [p.id, p]));
      return ((data || []) as Sub[]).map((row) =>
        editingRef.current.has(row.id) && prevMap.has(row.id)
          ? { ...row, title: prevMap.get(row.id)!.title }
          : row,
      );
    });
  };

  useEffect(() => { load(); }, [taskId]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`subs-rt-${taskId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `parent_id=eq.${taskId}` },
        load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, taskId]);


  const add = async () => {
    if (readOnly) return;
    const title = newTitle.trim();
    if (!title || !user) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title,
        parent_id: taskId,
        priority: "none",
        position: subs.length,
      })
      .select("id,title,completed,position")
      .single();
    if (error) return toast.error(error.message);
    if (data) setSubs((prev) => [...prev, data as Sub]);
    setNewTitle("");
  };

  const toggle = async (s: Sub) => {
    if (readOnly) return;
    const next = !s.completed;
    setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, completed: next } : x)));
    await supabase
      .from("tasks")
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", s.id);
  };

  const updateTitle = (id: string, title: string) => {
    if (readOnly) return;
    editingRef.current.add(id);
    setSubs((prev) => prev.map((x) => (x.id === id ? { ...x, title } : x)));
    if (writeTimers.current[id]) clearTimeout(writeTimers.current[id]);
    writeTimers.current[id] = setTimeout(async () => {
      await supabase.from("tasks").update({ title }).eq("id", id);
      // release the editing lock shortly after the realtime echo arrives
      setTimeout(() => editingRef.current.delete(id), 800);
    }, 500);
  };

  const remove = async (id: string) => {
    if (readOnly) return;
    setSubs((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorder = async (fromId: string, toId: string) => {
    if (readOnly) return;
    const fromIdx = subs.findIndex((s) => s.id === fromId);
    const toIdx = subs.findIndex((s) => s.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const reordered = arrayMove(subs, fromIdx, toIdx).map((s, i) => ({ ...s, position: i }));
    setSubs(reordered);
    await Promise.all(
      reordered.map((s, i) => supabase.from("tasks").update({ position: i }).eq("id", s.id)),
    );
  };

  const done = subs.filter((s) => s.completed).length;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1">
        <ListTree className="w-4 h-4" /> زیرتسک‌ها ({done}/{subs.length})
      </label>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          if (!over || active.id === over.id) return;
          reorder(String(active.id), String(over.id));
        }}
      >
        <SortableContext items={subs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {subs.map((s) => (
              <SortableSubtaskRow
                key={s.id}
                sub={s}
                readOnly={readOnly}
                onToggle={() => toggle(s)}
                onChangeTitle={(title) => updateTitle(s.id, title)}
                onOpen={onOpenSubtask ? () => onOpenSubtask(s.id) : undefined}
                onDelete={() => remove(s.id)}
              />
            ))}
            {subs.length === 0 && (
              <li className="text-xs text-muted-foreground/60 px-1 py-1">— زیرتسکی نیست —</li>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          disabled={readOnly}
          placeholder={readOnly ? "" : "+ زیرتسک جدید..."}
          className="h-7 text-xs flex-1"
          dir="auto"
        />
        <Button size="icon" variant="ghost" onClick={add} disabled={readOnly} className="h-7 w-7">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function SortableSubtaskRow({
  sub, readOnly, onToggle, onChangeTitle, onOpen, onDelete,
}: {
  sub: Sub;
  readOnly: boolean;
  onToggle: () => void;
  onChangeTitle: (title: string) => void;
  onOpen?: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id,
    disabled: readOnly,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-1.5 group">
      {!readOnly && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="pt-1.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0"
          aria-label="جابجایی"
          title="جابجایی"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="pt-1.5"><Checkbox checked={sub.completed} onCheckedChange={onToggle} disabled={readOnly} /></div>
      <AutoTextarea
        value={sub.title}
        onChange={(e) => onChangeTitle(e.target.value)}
        disabled={readOnly}
        minHeight={28}
        maxHeight={240}
        rows={1}
        className={`text-sm flex-1 min-w-0 border-none bg-transparent focus-visible:ring-1 px-1 py-1 leading-snug break-words whitespace-pre-wrap ${
          sub.completed ? "line-through text-muted-foreground" : ""
        }`}
      />
      {onOpen && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpen}
          className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100"
        >
          باز کردن
        </Button>
      )}
      {!readOnly && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </li>
  );
}
