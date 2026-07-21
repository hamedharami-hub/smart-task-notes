import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ListTree } from "lucide-react";
import { toast } from "sonner";
import { BidiText } from "@/components/BidiText";

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
      .order("created_at", { ascending: false });
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

  const done = subs.filter((s) => s.completed).length;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1">
        <ListTree className="w-4 h-4" /> زیرتسک‌ها ({done}/{subs.length})
      </label>

      <ul className="space-y-1">
        {subs.map((s) => (
          <li key={s.id} className="flex items-start gap-2 group">
            <div className="pt-1.5"><Checkbox checked={s.completed} onCheckedChange={() => toggle(s)} disabled={readOnly} /></div>
            <AutoTextarea
              value={s.title}
              onChange={(e) => updateTitle(s.id, e.target.value)}
              disabled={readOnly}
              minHeight={28}
              maxHeight={240}
              rows={1}
              className={`text-sm flex-1 min-w-0 border-none bg-transparent focus-visible:ring-1 px-1 py-1 leading-snug break-words whitespace-pre-wrap ${
                s.completed ? "line-through text-muted-foreground" : ""
              }`}
            />
            {onOpenSubtask && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenSubtask(s.id)}
                className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100"
              >
                باز کردن
              </Button>
            )}
            {!readOnly && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(s.id)}
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </li>
        ))}
        {subs.length === 0 && (
          <li className="text-xs text-muted-foreground/60 px-1 py-1">— زیرتسکی نیست —</li>
        )}
      </ul>

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
