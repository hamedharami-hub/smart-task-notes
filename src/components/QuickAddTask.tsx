import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Calendar as CalendarIcon, CalendarClock } from "lucide-react";
import { parseNaturalDate } from "@/lib/nlDate";
import { toPersianDigits } from "@/lib/persianDigits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DueDatePicker } from "@/components/DueDatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Defaults = {
  folder_id?: string | null;
  due_date?: string | null;
  parent_id?: string | null;
  tag_id?: string | null;
};

export function QuickAddTask({
  defaults = {},
  placeholder = "+ تسک جدید...",
  onCreated,
  className = "",
}: {
  defaults?: Defaults;
  placeholder?: string;
  onCreated?: (taskId: string) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [due, setDue] = useState<string | null>(defaults.due_date ?? null);

  // Live natural-language date detection (e.g. "فردا ساعت ۵").
  const parsed = useMemo(() => parseNaturalDate(title), [title]);

  const submit = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      // Prefer an explicitly-picked date; otherwise use a detected one and
      // clean the recognised words out of the title.
      const useParsed = !due && !defaults.due_date && !!parsed.dueDate;
      const finalTitle = (useParsed ? parsed.cleanedTitle : title).trim() || title.trim();
      const finalDue = due ?? defaults.due_date ?? (useParsed ? parsed.dueDate : null);
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: finalTitle,
          folder_id: defaults.folder_id ?? null,
          due_date: finalDue,
          parent_id: defaults.parent_id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      if (data && defaults.tag_id) {
        await supabase
          .from("task_tags")
          .insert({ task_id: data.id, tag_id: defaults.tag_id, user_id: user.id });
      }
      setTitle("");
      setDue(defaults.due_date ?? null);
      window.dispatchEvent(new Event("tasks-changed"));
      if (data) onCreated?.(data.id);
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setBusy(false);
    }
  };

  const showHint = !due && !defaults.due_date && !!parsed.dueDate;
  const hintLabel = showHint
    ? new Date(parsed.dueDate!).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`${className}`} dir="rtl">
      <div className="flex gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="flex-1 h-10 text-sm bg-background"
          dir="auto"
          disabled={busy}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              title="تاریخ"
              className={`h-10 w-10 shrink-0 ${due ? "border-primary text-primary" : ""}`}
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="end">
            <DueDatePicker value={due} onChange={setDue} compact />
          </PopoverContent>
        </Popover>
        <Button onClick={submit} disabled={busy || !title.trim()} size="icon" title="افزودن" className="h-10 w-10 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
      {showHint && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-primary animate-fade-in">
          <CalendarClock className="w-3.5 h-3.5" />
          <span>{toPersianDigits(hintLabel)}</span>
          <span className="text-muted-foreground">— Enter = ثبت</span>
        </div>
      )}
    </div>
  );
}
