import { useEffect, useState } from "react";
import { Plus, Flame, Trash2, Target, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, subDays, isSameDay, startOfWeek } from "date-fns";
import { getCalendarSystem, formatDate, jalaliDayOfWeek, WEEKDAY_SHORT_FA, type CalendarSystem } from "@/lib/jalali";
import { toast } from "sonner";
import { useTapGestures } from "@/lib/useTapGestures";
import { haptic } from "@/lib/haptics";

type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: "daily" | "weekly";
  target_per_week: number;
};
type Log = { habit_id: string; log_date: string; note?: string | null };

export default function HabitsView() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [target, setTarget] = useState<number>(7);
  const [system, setSystem] = useState<CalendarSystem>(getCalendarSystem());

  const load = async () => {
    if (!user) return;
    const [h, l] = await Promise.all([
      supabase.from("habits").select("*"),
      supabase.from("habit_logs").select("habit_id, log_date, note").gte("log_date", format(subDays(new Date(), 60), "yyyy-MM-dd")),
    ]);
    setHabits((h.data || []) as any);
    setLogs((l.data || []) as any);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!name.trim() || !user) return;
    const { error } = await supabase.from("habits").insert({
      user_id: user.id,
      name,
      frequency,
      target_per_week: frequency === "daily" ? 7 : Math.max(1, Math.min(7, target)),
    } as any);
    if (error) toast.error(error.message);
    else { setName(""); load(); }
  };

  const toggle = async (habit_id: string, date: Date) => {
    if (!user) return;
    const d = format(date, "yyyy-MM-dd");
    const exists = logs.find((l) => l.habit_id === habit_id && l.log_date === d);
    if (exists) {
      await supabase.from("habit_logs").delete().eq("habit_id", habit_id).eq("log_date", d);
    } else {
      await supabase.from("habit_logs").insert({ habit_id, user_id: user.id, log_date: d });
    }
    load();
  };

  const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));

  // Streak that respects frequency:
  // - daily: consecutive days
  // - weekly: consecutive weeks where target met
  const streak = (h: Habit) => {
    if (h.frequency === "weekly") {
      let s = 0;
      for (let w = 0; w < 52; w++) {
        const wkStart = startOfWeek(subDays(new Date(), w * 7), { weekStartsOn: 6 });
        const count = logs.filter((l) => {
          if (l.habit_id !== h.id) return false;
          const ld = new Date(l.log_date);
          const diff = (ld.getTime() - wkStart.getTime()) / (1000 * 60 * 60 * 24);
          return diff >= 0 && diff < 7;
        }).length;
        if (count >= (h.target_per_week || 1)) s++;
        else if (w > 0) break;
        else break;
      }
      return s;
    }
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      if (logs.find((l) => l.habit_id === h.id && l.log_date === d)) s++;
      else if (i > 0) break;
      else break;
    }
    return s;
  };

  const weekProgress = (h: Habit) => {
    const wkStart = startOfWeek(new Date(), { weekStartsOn: 6 });
    const count = logs.filter((l) => {
      if (l.habit_id !== h.id) return false;
      const ld = new Date(l.log_date);
      const diff = (ld.getTime() - wkStart.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff < 7;
    }).length;
    return { count, target: h.target_per_week || 7 };
  };

  // Note dialog state for long-press on a day
  const [noteDialog, setNoteDialog] = useState<{ habit_id: string; date: Date; note: string } | null>(null);
  const openNote = (habit_id: string, date: Date) => {
    const d = format(date, "yyyy-MM-dd");
    const existing = logs.find((l) => l.habit_id === habit_id && l.log_date === d);
    setNoteDialog({ habit_id, date, note: existing?.note || "" });
  };
  const saveNote = async () => {
    if (!noteDialog || !user) return;
    const d = format(noteDialog.date, "yyyy-MM-dd");
    const { habit_id, note } = noteDialog;
    const exists = logs.find((l) => l.habit_id === habit_id && l.log_date === d);
    if (exists) {
      await supabase.from("habit_logs").update({ note }).eq("habit_id", habit_id).eq("log_date", d);
    } else {
      await supabase.from("habit_logs").insert({ habit_id, user_id: user.id, log_date: d, note });
    }
    setNoteDialog(null);
    haptic("success");
    toast.success("یادداشت ذخیره شد");
    load();
  };

  return (
    <div dir="rtl" className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-20 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">عادت‌ها</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">پیگیری روزانه، بدون فشار.</p>
      </div>
      <Card className="p-4 space-y-3 bg-card/60 border-border/60">
        <Input placeholder="عادت جدید..." value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} className="bg-background/50" />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => { setFrequency("daily"); setTarget(7); }}
              className={`px-3 py-1.5 text-xs rounded-md transition ${frequency === "daily" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >روزانه</button>
            <button
              type="button"
              onClick={() => { setFrequency("weekly"); setTarget(3); }}
              className={`px-3 py-1.5 text-xs rounded-md transition ${frequency === "weekly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >هفتگی</button>
          </div>
          {frequency === "weekly" && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="w-3 h-3" />
              <span>هدف:</span>
              <Input
                type="number"
                min={1}
                max={7}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value) || 1)}
                className="h-7 w-16 text-xs bg-background/50"
              />
              <span>روز/هفته</span>
            </div>
          )}
          <Button onClick={add} size="sm" className="ms-auto"><Plus className="w-4 h-4" /></Button>
        </div>
      </Card>

      <div className="space-y-4">
        {habits.map((h) => {
          const wp = weekProgress(h);
          const met = wp.count >= wp.target;
          const s = streak(h);
          return (
            <Card key={h.id} className="p-4 bg-card/60 border-border/60">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className="text-2xl">{h.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{h.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Flame className={`w-3 h-3 ${s > 0 ? "text-orange-500" : "text-muted-foreground"}`} /> {s} روز پیاپی
                      </span>
                      <span className="text-border">|</span>
                      <span>{met ? "هدف هفتگی تأمین‌شد" : `${wp.count}/${wp.target} هفته`}</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={async () => {
                  await supabase.from("habits").delete().eq("id", h.id);
                  load();
                }}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (wp.count / wp.target) * 100)}%` }} />
              </div>
              <div className="flex gap-1 justify-between">
                {days.map((d) => {
                  const log = logs.find((l) => l.habit_id === h.id && isSameDay(new Date(l.log_date), d));
                  const done = !!log;
                  const hasNote = !!log?.note;
                  return (
                    <DayCell
                      key={d.toISOString()}
                      date={d}
                      system={system}
                      done={done}
                      hasNote={hasNote}
                      onTap={() => toggle(h.id, d)}
                      onLongPress={() => openNote(h.id, d)}
                    />
                  );
                })}
              </div>
            </Card>
          );
        })}
        {habits.length === 0 && <Card className="p-8 text-center text-muted-foreground border-dashed border-border/60 bg-card/40">هنوز عادتی نداری</Card>}
      </div>

      <Dialog open={!!noteDialog} onOpenChange={(v) => !v && setNoteDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              یادداشت {noteDialog && format(noteDialog.date, "yyyy/MM/dd")}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="چه احساسی داشتی؟ چه چیزی را یاد گرفتی؟"
            value={noteDialog?.note || ""}
            onChange={(e) => setNoteDialog((s) => s ? { ...s, note: e.target.value } : s)}
            className="min-h-[120px]"
            dir="auto"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteDialog(null)}>انصراف</Button>
            <Button onClick={saveNote}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayCell({
  date,
  system,
  done,
  hasNote,
  onTap,
  onLongPress,
}: {
  date: Date;
  system: CalendarSystem;
  done: boolean;
  hasNote: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const { handlers } = useTapGestures({
    onSingleTap: onTap,
    onLongPress,
  });
  const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
  return (
    <button
      {...(isTouch ? handlers : {})}
      onClick={isTouch ? undefined : onTap}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      className={`relative flex-1 aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition select-none border
        ${done ? "bg-primary/15 text-primary border-primary/40" : "bg-muted/50 border-transparent hover:border-primary/30 hover:bg-accent/30"}`}
    >
      <span className="text-[10px] text-muted-foreground">
        {system === "jalali" ? WEEKDAY_SHORT_FA[jalaliDayOfWeek(date)] : format(date, "EEE")[0]}
      </span>
      <span className="font-semibold">{system === "jalali" ? formatDate(date, "d", "jalali") : format(date, "d")}</span>
      {hasNote && (
        <StickyNote className="w-2.5 h-2.5 absolute top-1 end-1 text-primary opacity-80" />
      )}
    </button>
  );
}
