import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Clock } from "lucide-react";
import PomodoroTimer from "@/components/PomodoroTimer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, getCalendarSystem } from "@/lib/jalali";

type Session = {
  id: string;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  completed: boolean;
};

interface Props {
  task: { id: string; title: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PomodoroSheet({ task, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const system = getCalendarSystem();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!open || !user || !task) return;
    (async () => {
      const { data } = await supabase
        .from("pomodoro_sessions")
        .select("id,duration_minutes,started_at,ended_at,completed")
        .eq("user_id", user.id)
        .eq("task_id", task.id)
        .eq("completed", true)
        .order("started_at", { ascending: false });
      setSessions((data || []) as Session[]);
    })();
  }, [open, task, user]);

  const count = sessions.length;
  const total = sessions.reduce((s, r) => s + (r.duration_minutes || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] flex flex-col px-4 pb-6">
        <SheetHeader className="sr-only">
          <SheetTitle>Pomodoro</SheetTitle>
        </SheetHeader>
        <div className="px-1 pt-2 space-y-0.5">
          <h3 className="font-semibold text-sm truncate text-foreground">{task?.title || "تمرکز"}</h3>
          <p className="text-xs text-muted-foreground">
            {count} جلسه · {total} دقیقه تمرکز
          </p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <PomodoroTimer taskId={task?.id || null} compact onSessionComplete={load} />
          {sessions.length > 0 && (
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> جلسات اخیر
              </h4>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 p-2.5 text-xs"
                  >
                    <span className="text-foreground/80">
                      {formatDate(new Date(s.started_at), "d MMM HH:mm", system)}
                    </span>
                    <span className="font-mono text-foreground">{s.duration_minutes} دقیقه</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
