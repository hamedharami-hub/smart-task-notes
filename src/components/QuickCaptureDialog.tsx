import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ListTodo, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { parseNaturalDate } from "@/lib/nlDate";
import { CalendarClock } from "lucide-react";
import { toPersianDigits } from "@/lib/persianDigits";

export default function QuickCaptureDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"task" | "note">("task");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseNaturalDate(title), [title]);
  const dateHint = tab === "task" && parsed.dueDate
    ? new Date(parsed.dueDate).toLocaleDateString("fa-IR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.key === "n" || e.key === "N") && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", keyHandler);
    window.addEventListener("lov:open-quick-capture", openHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
      window.removeEventListener("lov:open-quick-capture", openHandler);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setTab("task");
    }
  }, [open]);

  const submit = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      if (tab === "task") {
        const parsed = parseNaturalDate(title);
        const insertTitle = (parsed.dueDate ? parsed.cleanedTitle : title).trim() || title.trim();
        const { data, error } = await supabase
          .from("tasks")
          .insert({ user_id: user.id, title: insertTitle, due_date: parsed.dueDate })
          .select()
          .single();
        if (error) throw error;
        toast.success(parsed.dueDate ? "تسک با تاریخ ساخته شد" : "تسک ساخته شد");
        window.dispatchEvent(new Event("tasks-changed"));
        setOpen(false);
        if (data) navigate(`/app/tasks/${data.id}`);
      } else {
        const { data, error } = await supabase
          .from("notes")
          .insert({ user_id: user.id, title: title.trim(), content: "" })
          .select()
          .single();
        if (error) throw error;
        toast.success("نوت ساخته شد");
        setOpen(false);
        navigate("/app/notes");
      }
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">ثبت سریع</DialogTitle>
        </DialogHeader>
        <div
          onTouchStart={(e) => {
            (e.currentTarget as any)._sx = e.touches[0].clientX;
            (e.currentTarget as any)._sy = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            const sx = (e.currentTarget as any)._sx ?? 0;
            const sy = (e.currentTarget as any)._sy ?? 0;
            const dx = e.changedTouches[0].clientX - sx;
            const dy = Math.abs(e.changedTouches[0].clientY - sy);
            if (dy > 60 || Math.abs(dx) < 50) return;
            // RTL: swipe left → next (note), swipe right → previous (task)
            if (dx < 0) setTab("note");
            else setTab("task");
          }}
        >
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="task" className="gap-2">
              <ListTodo className="w-4 h-4" /> تسک
            </TabsTrigger>
            <TabsTrigger value="note" className="gap-2">
              <FileText className="w-4 h-4" /> نوت
            </TabsTrigger>
          </TabsList>
          <TabsContent value="task" className="mt-3">
            <AutoTextarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="عنوان تسک... (مثلاً: فردا ساعت ۵ خرید)"
              dir="auto"
              disabled={busy}
              rows={1}
              minHeight={40}
              maxHeight={160}
              className="min-h-[40px] max-h-[160px] py-2.5"
            />
            {dateHint && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary animate-fade-in">
                <CalendarClock className="w-3.5 h-3.5" />
                <span>{toPersianDigits(dateHint)}</span>
              </div>
            )}
          </TabsContent>
          <TabsContent value="note" className="mt-3">
            <AutoTextarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="عنوان نوت..."
              dir="auto"
              disabled={busy}
              rows={1}
              minHeight={40}
              maxHeight={160}
              className="min-h-[40px] max-h-[160px] py-2.5"
            />
          </TabsContent>
        </Tabs>
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-[10px] text-muted-foreground ltr">⌘N • Enter = ثبت</span>
          <Button onClick={submit} disabled={busy || !title.trim()} size="sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "ثبت"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
