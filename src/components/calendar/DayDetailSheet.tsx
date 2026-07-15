import { useEffect, useState } from "react";
import { format, isSameDay } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus, Activity, ListChecks, ListTodo } from "lucide-react";
import { formatDate, toPersianDigits, type CalendarSystem } from "@/lib/jalali";
import { isHoliday, type Holiday } from "@/lib/holidays";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Task = { id: string; title: string; due_date: string | null; priority: string };

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
const PRIORITY_COLOR: Record<string, string> = {
  high: "hsl(var(--destructive))",
  medium: "hsl(var(--primary))",
  low: "hsl(var(--muted-foreground))",
  none: "hsl(var(--muted-foreground) / 0.4)",
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayDetailSheet({
  date, open, onOpenChange, tasks, holidays, system, onTaskCreated,
}: {
  date: Date | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: Task[];
  holidays: Holiday[];
  system: CalendarSystem;
  onTaskCreated?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkin, setCheckin] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newHour, setNewHour] = useState<number>(9);

  useEffect(() => {
    if (!date || !user || !open) return;
    const ds = format(date, "yyyy-MM-dd");
    supabase.from("daily_checkins").select("*").eq("checkin_date", ds).maybeSingle()
      .then(({ data }) => setCheckin(data));
  }, [date, user, open]);

  if (!date) return null;
  const dayTasks = tasks
    .filter((t) => t.due_date && isSameDay(new Date(t.due_date), date))
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 3;
      const pb = PRIORITY_ORDER[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
    });
  const dayHolidays = isHoliday(date, holidays);
  const isFriday = date.getDay() === 5;

  const addTask = async () => {
    if (!newTitle.trim() || !user) return;
    const dt = new Date(date);
    dt.setHours(newHour, 0, 0, 0);
    const { error } = await supabase.from("tasks").insert({
      title: newTitle, user_id: user.id, due_date: dt.toISOString(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تسک ثبت شد");
      setNewTitle("");
      onTaskCreated?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <SheetHeader className="text-end">
          <SheetTitle className="flex items-center justify-between">
            <span>
              {system === "jalali"
                ? formatDate(date, "EEEE d MMMM yyyy", "jalali")
                : format(date, "EEEE, MMMM d, yyyy")}
            </span>
            {dayHolidays.length > 0 && (
              <span className="text-xs text-rose-500">{dayHolidays[0].country_code === "IR" ? "🇮🇷" : "🇦🇺"} {dayHolidays[0].local_name || dayHolidays[0].name}</span>
            )}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {system === "jalali" ? format(date, "EEEE, MMMM d, yyyy") : formatDate(date, "EEEE d MMMM yyyy", "jalali")}
            {(system === "jalali" && isFriday) && <span className="text-rose-500 me-2">• تعطیل</span>}
          </p>
        </SheetHeader>

        {dayTasks.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground"><ListTodo className="w-4 h-4 text-primary" /> تسک‌های این روز</h3>
            <div className="border border-border/60 rounded-xl divide-y bg-card/40 max-h-[180px] overflow-y-auto">
              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { onOpenChange(false); navigate(`/app/tasks/${t.id}`); }}
                  className="flex items-center gap-2 w-full text-end px-3 py-2 text-sm hover:bg-accent/30 transition"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.none }} />
                  <span className="truncate flex-1">{t.title}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {toPersianDigits(String(t.due_date ? new Date(t.due_date).getHours().toString().padStart(2, "0") : "--"))}
                    :{toPersianDigits("00")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {/* Hourly Timeline */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground"><ListChecks className="w-4 h-4 text-primary" /> خط‌زمان</h3>
            <div className="border border-border/60 rounded-xl divide-y max-h-[300px] overflow-y-auto bg-card/40">
              {HOURS.map((h) => {
                const slot = dayTasks.filter((t) => t.due_date && new Date(t.due_date).getHours() === h);
                return (
                  <div key={h} className="grid grid-cols-[40px_1fr] gap-2 p-2 text-xs min-h-[32px]">
                    <div className="text-muted-foreground tabular-nums pt-0.5">{toPersianDigits(String(h).padStart(2, "0"))}</div>
                    <div className="space-y-1">
                      {slot.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { onOpenChange(false); navigate(`/app/tasks/${t.id}`); }}
                          className="block w-full text-end bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-1 truncate hover:bg-primary/15 transition"
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {/* Quick Add */}
            <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-card/40">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground"><Plus className="w-4 h-4 text-primary" /> تسک جدید برای این روز</h3>
              <Input placeholder="عنوان تسک" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} />
              <div className="flex items-center gap-2">
                <select
                  className="flex h-9 rounded-md border bg-background px-2 text-sm flex-1"
                  value={newHour}
                  onChange={(e) => setNewHour(+e.target.value)}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, "0"))}:۰۰</option>
                  ))}
                </select>
                <Button onClick={addTask} size="sm">افزودن</Button>
              </div>
            </div>

            {/* Check-in */}
            <div className="border border-border/60 rounded-xl p-4 space-y-2 bg-card/40">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground"><Activity className="w-4 h-4 text-primary" /> Check-in</h3>
              {checkin ? (
                <div className="text-xs grid grid-cols-2 gap-1 text-muted-foreground">
                  {checkin.mood != null && <div>خلق: {toPersianDigits(checkin.mood)}/۱۰</div>}
                  {checkin.energy != null && <div>انرژی: {toPersianDigits(checkin.energy)}/۱۰</div>}
                  {checkin.focus != null && <div>تمرکز: {toPersianDigits(checkin.focus)}/۱۰</div>}
                  {checkin.stress != null && <div>استرس: {toPersianDigits(checkin.stress)}/۱۰</div>}
                  {checkin.sleep_hours != null && <div>خواب: {toPersianDigits(checkin.sleep_hours)} ساعت</div>}
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/app/checkin")}>
                  ثبت Check-in
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
