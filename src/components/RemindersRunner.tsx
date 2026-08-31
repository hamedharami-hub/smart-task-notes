import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { loadSettings, checkAndFireReminders, ensureDailyTasks, checkTaskReminders } from "@/lib/reminders";
import { applyFontSize, applyUIScale, type FontSize } from "@/lib/uiScale";

/**
 * Mounts globally inside AppLayout.
 * - Polls every 60s for reminders while the tab is visible.
 * - When the tab is hidden, the interval is cleared (saves battery + CPU on mobile).
 * - When it becomes visible again, runs a tick immediately and restarts the interval.
 */
export default function RemindersRunner() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let stopped = false;
    let intervalId: number | null = null;

    const tick = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const s = await loadSettings(user.id);
      if (!s || stopped) return;
      if ((s as any).font_size) applyFontSize((s as any).font_size as FontSize);
      if ((s as any).ui_scale) applyUIScale((s as any).ui_scale);
      await ensureDailyTasks(user.id, s);
      await checkAndFireReminders(s);
      await checkTaskReminders(user.id, s);
    };

    const start = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(tick, 60_000);
    };
    const stop = () => {
      if (intervalId != null) { window.clearInterval(intervalId); intervalId = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    tick();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  return null;
}
