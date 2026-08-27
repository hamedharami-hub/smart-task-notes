import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Clock, ListChecks, TrendingUp, Target } from "lucide-react";
import PomodoroTimer from "@/components/PomodoroTimer";
import { subDays, startOfDay, format, isSameDay } from "date-fns";
import { getCalendarSystem, jalaliDayOfWeek, WEEKDAY_SHORT_FA, formatDate } from "@/lib/jalali";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { awardWaterDrops } from "@/lib/garden";

type SessionRow = { duration_minutes: number; task_id: string | null; ended_at: string | null; tasks?: { title: string } | null };
type WeekRow = { duration_minutes: number; started_at: string };
type TaskOption = { id: string; title: string; due_date: string | null };

export default function PomodoroView() {
  const { user } = useAuth();
  const [today, setToday] = useState<SessionRow[]>([]);
  const [weekSessions, setWeekSessions] = useState<WeekRow[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const system = getCalendarSystem();

  useEffect(() => {
    if (!user) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const weekStart = startOfDay(subDays(new Date(), 6));
    supabase.from("pomodoro_sessions")
      .select("duration_minutes, task_id, ended_at, tasks(title)")
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("started_at", start.toISOString())
      .order("ended_at", { ascending: false })
      .then(({ data }) => setToday((data as SessionRow[] | null) || []));
    supabase.from("pomodoro_sessions")
      .select("duration_minutes, started_at")
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("started_at", weekStart.toISOString())
      .order("started_at", { ascending: true })
      .then(({ data }) => setWeekSessions((data as WeekRow[] | null) || []));
    supabase.from("tasks")
      .select("id,title,due_date")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true })
      .limit(50)
      .then(({ data }) => setTasks((data as TaskOption[] | null) || []));
  }, [user, refreshTick]);

  const totalMin = today.reduce((s, r) => s + (r.duration_minutes || 0), 0);

  const weekData = useMemo(() => {
    const days: { label: string; minutes: number; date: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const minutes = weekSessions
        .filter((s) => isSameDay(new Date(s.started_at), d))
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const weekday = system === "jalali" ? WEEKDAY_SHORT_FA[jalaliDayOfWeek(d)] : format(d, "EEE")[0];
      const dayNum = system === "jalali" ? formatDate(d, "d", "jalali") : format(d, "d");
      days.push({ label: `${weekday} ${dayNum}`, minutes, date: d });
    }
    return days;
  }, [weekSessions, system]);

  const taskTotals = new Map<string, { title: string; min: number }>();
  let freeMin = 0;
  for (const r of today) {
    if (r.task_id && r.tasks) {
      const cur = taskTotals.get(r.task_id) || { title: r.tasks.title, min: 0 };
      cur.min += r.duration_minutes;
      taskTotals.set(r.task_id, cur);
    } else freeMin += r.duration_minutes;
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div dir="rtl" className="p-4 md:p-6 max-w-md mx-auto space-y-4">
      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3 h-3" /> تسک فعلی
          </label>
          <Select value={selectedTaskId || "none"} onValueChange={(v) => setSelectedTaskId(v === "none" ? null : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="انتخاب تسک برای تمرکز" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون تسک</SelectItem>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="truncate max-w-[16rem] block">{t.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTask && (
            <p className="text-[10px] text-muted-foreground">
              {selectedTask.due_date
                ? `سررسید: ${system === "jalali" ? formatDate(new Date(selectedTask.due_date), "d MMM", "jalali") : format(new Date(selectedTask.due_date), "d MMM")}`
                : "بدون سررسید"}
            </p>
          )}
        </div>
        <PomodoroTimer
          taskId={selectedTaskId}
          onSessionComplete={() => {
            awardWaterDrops(25, "تکمیل جلسه پومودورو");
            setRefreshTick((t) => t + 1);
          }}
        />
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> امروز
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tabular-nums text-primary text-center">
            {totalMin} <span className="text-sm font-normal text-muted-foreground">دقیقه تمرکز</span>
          </div>
          <div className="text-xs text-muted-foreground text-center">{today.length} جلسه کامل</div>

          {(taskTotals.size > 0 || freeMin > 0) && (
            <div className="border-t pt-3 mt-3 space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
                <ListChecks className="w-3 h-3" /> تفکیک
              </div>
              {Array.from(taskTotals.entries()).map(([id, v]) => (
                <div key={id} className="flex justify-between text-sm">
                  <span className="truncate flex-1 ms-2">{v.title}</span>
                  <span className="tabular-nums text-muted-foreground">{v.min}د</span>
                </div>
              ))}
              {freeMin > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">بدون تسک</span>
                  <span className="tabular-nums text-muted-foreground">{freeMin}د</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> {system === "jalali" ? "۷ روز اخیر" : "Last 7 days"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem" }}
                  formatter={(value: number) => [`${value} دقیقه`, "تمرکز"]}
                  labelFormatter={(label: string) => label}
                />
                <Bar dataKey="minutes" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
