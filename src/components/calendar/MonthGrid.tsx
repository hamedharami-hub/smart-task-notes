import { format, eachDayOfInterval, isSameDay, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { formatDate, toPersianDigits, WEEKDAY_SHORT_FA, type CalendarSystem } from "@/lib/jalali";
import { isHoliday, type Holiday } from "@/lib/holidays";
import { computePhase, type CycleProfile, type CycleLog, PHASE_META } from "@/lib/cycle";
type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type Task = { id: string; title: string; due_date: string | null; priority: string };

const PRIORITY_COLOR: Record<string, string> = {
  high: "hsl(var(--destructive))",
  medium: "hsl(var(--primary))",
  low: "hsl(var(--muted-foreground))",
  none: "hsl(var(--muted-foreground) / 0.4)",
};

export default function MonthGrid({
  month, tasks, holidays, system, onDayClick, cycleProfile, cycleLogs,
}: {
  month: Date;
  tasks: Task[];
  holidays: Holiday[];
  system: CalendarSystem;
  onDayClick: (d: Date) => void;
  cycleProfile?: CycleProfile | null;
  cycleLogs?: CycleLog[];
}) {
  const weekStartsOn: WeekStartsOn = system === "jalali" ? 6 : 0;
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn }),
  });
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
        {(system === "jalali" ? WEEKDAY_SHORT_FA : ["S", "M", "T", "W", "T", "F", "S"]).map((d, i) => (
          <div key={i} className="p-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dayTasks = tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), d));
          const dayHolidays = isHoliday(d, holidays);
          const isFriday = d.getDay() === 5;
          const isOff = dayHolidays.length > 0 || (system === "jalali" && isFriday);
          const isHolidayDay = dayHolidays.length > 0;
          const dayLabel = system === "jalali"
            ? toPersianDigits(formatDate(d, "d", "jalali"))
            : format(d, "d");
          const phase = cycleProfile && cycleLogs ? computePhase(d, cycleLogs, cycleProfile) : null;
          const phaseColor = phase && phase.phase !== "unknown" ? PHASE_META[phase.phase].color : null;
          const phaseStyle = phaseColor
            ? { borderColor: `${phaseColor}30`, background: `${phaseColor}${phase?.predicted ? "08" : "12"}` }
            : undefined;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              style={phaseStyle}
              className={`aspect-square border rounded-lg p-1.5 text-xs flex flex-col text-end transition hover:bg-accent/40 hover:border-primary/30
                ${isSameMonth(d, month) ? "" : "opacity-30"}
                ${isSameDay(d, new Date()) ? "ring-1 ring-primary bg-primary/5" : ""}
                ${isHolidayDay && !phaseColor ? "bg-amber-500/5 border-amber-500/25" : ""}
                ${isFriday && !isHolidayDay && !phaseColor ? "text-muted-foreground" : ""}`}
            >
              <div className={`font-medium flex items-center justify-between ${isHolidayDay ? "text-amber-600 dark:text-amber-400" : ""}`}>
                <span>{dayLabel}</span>
                {isHolidayDay && (
                  <span className="text-[8px]">{dayHolidays[0].country_code === "IR" ? "🇮🇷" : "🇦🇺"}</span>
                )}
              </div>
              <div className="flex-1 overflow-hidden space-y-0.5 mt-0.5">
                {dayHolidays.slice(0, 1).map((h) => (
                  <div key={h.id} className="text-[9px] text-amber-600 dark:text-amber-400 truncate" title={h.local_name || h.name}>
                    {h.local_name || h.name}
                  </div>
                ))}
                {dayTasks.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-auto">
                    {dayTasks.slice(0, 2).map((t) => (
                      <div key={t.id} className="flex items-center gap-1 text-[9px] leading-tight">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.none }} />
                        <span className="truncate text-foreground/80">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="text-[9px] text-muted-foreground px-2">+{toPersianDigits(dayTasks.length - 2)}</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
