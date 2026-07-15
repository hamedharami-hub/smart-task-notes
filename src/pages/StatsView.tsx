import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfDay, subDays, isSameDay, isWithinInterval } from "date-fns";
import { getCalendarSystem, formatDate, toPersianDigits, jalaliDayOfWeek, WEEKDAY_SHORT_FA, type CalendarSystem } from "@/lib/jalali";
import {
  Bar,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
} from "recharts";
import { CheckCircle2, Clock, Flame, AlertCircle, Target, TrendingUp } from "lucide-react";

type TaskRow = { id: string; title: string; completed: boolean; completed_at: string | null; due_date: string | null; priority: string };
type PomRow = { duration_minutes: number; started_at: string };
type HabitLogRow = { habit_id: string; log_date: string; habits: { name: string; target_per_week: number; frequency: "daily" | "weekly" } | null };

type Period = "today" | "week" | "month";

export default function StatsView() {
  const { user } = useAuth();
  const [system] = useState<CalendarSystem>(getCalendarSystem());
  const [period, setPeriod] = useState<Period>("week");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [pomSessions, setPomSessions] = useState<PomRow[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLogRow[]>([]);

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(() => startOfDay(subDays(new Date(), 6)), []);
  const monthStart = useMemo(() => startOfDay(subDays(new Date(), 29)), []);

  const periodStart = period === "today" ? todayStart : period === "week" ? weekStart : monthStart;

  useEffect(() => {
    if (!user) return;
    const start = startOfDay(subDays(new Date(), 29));
    const end = new Date();
    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();

    supabase.from("tasks")
      .select("id,title,completed,completed_at,due_date,priority")
      .eq("user_id", user.id)
      .or(`and(completed.eq.true,completed_at.gte.${isoStart},completed_at.lte.${isoEnd}),and(completed.eq.false,due_date.lt.${todayStart.toISOString()})`)
      .then(({ data }) => setTasks((data as TaskRow[] | null) || []));

    supabase.from("pomodoro_sessions")
      .select("duration_minutes,started_at")
      .eq("user_id", user.id)
      .eq("completed", true)
      .gte("started_at", isoStart)
      .lte("started_at", isoEnd)
      .order("started_at", { ascending: true })
      .then(({ data }) => setPomSessions((data as PomRow[] | null) || []));

    supabase.from("habit_logs")
      .select("habit_id, log_date, habits(name, target_per_week, frequency)")
      .eq("user_id", user.id)
      .gte("log_date", format(start, "yyyy-MM-dd"))
      .lte("log_date", format(end, "yyyy-MM-dd"))
      .order("log_date", { ascending: true })
      .then(({ data }) => setHabitLogs((data as HabitLogRow[] | null) || []));
  }, [user, todayStart]);

  const periodEnd = useMemo(() => new Date(), []);

  const completedTasks = useMemo(() =>
    tasks.filter((t) => t.completed && t.completed_at && isWithinInterval(new Date(t.completed_at), { start: periodStart, end: periodEnd })),
  [tasks, periodStart, periodEnd]);

  const overdueTasks = useMemo(() =>
    tasks.filter((t) => !t.completed && t.due_date && new Date(t.due_date) < todayStart),
  [tasks, todayStart]);

  const focusMinutes = useMemo(() =>
    pomSessions
      .filter((s) => isWithinInterval(new Date(s.started_at), { start: periodStart, end: periodEnd }))
      .reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
  [pomSessions, periodStart, periodEnd]);

  const habitStats = useMemo(() => {
    const byHabit = new Map<string, { name: string; target: number; frequency: "daily" | "weekly"; days: Set<string> }>();
    habitLogs.forEach((l) => {
      const h = l.habits;
      if (!h) return;
      if (!byHabit.has(l.habit_id)) {
        byHabit.set(l.habit_id, { name: h.name, target: h.target_per_week || 7, frequency: h.frequency, days: new Set() });
      }
      byHabit.get(l.habit_id)!.days.add(l.log_date);
    });

    const start = periodStart;
    const daysCount = period === "today" ? 1 : period === "week" ? 7 : 30;
    const expectedDays = period === "today" ? 1 : period === "week" ? 7 : 30;

    return Array.from(byHabit.entries()).map(([id, h]) => {
      const logsInPeriod = Array.from(h.days).filter((d) => {
        const date = new Date(d);
        return date >= start && date <= periodEnd;
      }).length;
      const targetDays = h.frequency === "daily" ? expectedDays : Math.min(expectedDays / 7, 4) * (h.target || 1);
      const rate = targetDays > 0 ? Math.min(100, Math.round((logsInPeriod / targetDays) * 100)) : 0;
      return { id, name: h.name, logs: logsInPeriod, target: Math.round(targetDays), rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [habitLogs, period, periodStart, periodEnd]);

  const chartData = useMemo(() => {
    const days = period === "today"
      ? [startOfDay(new Date())]
      : Array.from({ length: period === "week" ? 7 : 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)));

    return days.map((d) => {
      const taskCount = tasks.filter((t) => t.completed && t.completed_at && isSameDay(new Date(t.completed_at), d)).length;
      const minutes = pomSessions
        .filter((s) => isSameDay(new Date(s.started_at), d))
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const weekday = system === "jalali" ? WEEKDAY_SHORT_FA[jalaliDayOfWeek(d)] : format(d, "EEE")[0];
      const dayNum = system === "jalali" ? formatDate(d, "d", "jalali") : format(d, "d");
      return { label: `${weekday} ${dayNum}`, tasks: taskCount, minutes, date: d };
    });
  }, [tasks, pomSessions, period, system]);

  const bestHabit = habitStats[0];

  return (
    <div dir="rtl" className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 pb-24 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> آمار و خلاصه
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {system === "jalali" ? formatDate(new Date(), "d MMMM yyyy", "jalali") : format(new Date(), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={period === p ? "secondary" : "ghost"}
              className="text-xs h-8"
              onClick={() => setPeriod(p)}
            >
              {p === "today" ? "امروز" : p === "week" ? "۷ روز" : "۳۰ روز"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={CheckCircle2} label="تسک انجام‌شده" value={toPersianDigits(completedTasks.length)} color="text-emerald-500" />
        <SummaryCard icon={Clock} label="دقیقه تمرکز" value={toPersianDigits(focusMinutes)} color="text-amber-500" />
        <SummaryCard icon={Flame} label="عادت موفق" value={bestHabit ? toPersianDigits(bestHabit.rate) + "%" : "—"} color="text-orange-500" />
        <SummaryCard icon={AlertCircle} label="تسک عقب‌افتاده" value={toPersianDigits(overdueTasks.length)} color="text-rose-500" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> فعالیت روزانه
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem" }}
                  formatter={(value: number, name: string) => [name === "minutes" ? `${value} دقیقه` : value, name === "minutes" ? "تمرکز" : "تسک"]}
                  labelFormatter={(label: string) => label}
                />
                <Bar yAxisId="left" dataKey="tasks" radius={[4, 4, 0, 0]} fill="hsl(var(--primary) / 0.7)" />
                <Line yAxisId="right" type="monotone" dataKey="minutes" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {habitStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" /> پیشرفت عادت‌ها
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {habitStats.map((h) => (
              <div key={h.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate flex-1">{h.name}</span>
                  <span className="text-muted-foreground tabular-nums">{toPersianDigits(h.logs)}/{toPersianDigits(h.target)} • {toPersianDigits(h.rate)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, h.rate)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {completedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> آخرین تسک‌های انجام‌شده
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {completedTasks.slice(-5).reverse().map((t) => (
              <div key={t.id} className="py-2 flex items-center justify-between text-sm">
                <span className="truncate flex-1">{t.title}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {t.completed_at ? (system === "jalali" ? formatDate(new Date(t.completed_at), "d MMM", "jalali") : format(new Date(t.completed_at), "d MMM")) : "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof CheckCircle2; label: string; value: string; color: string }) {
  return (
    <Card className="p-4 bg-card/60 border-border/60">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
