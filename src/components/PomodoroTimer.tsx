import { useEffect, useRef, useState, type TouchEvent as RTouchEvent } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AMBIENT_SOUNDS, SOUND_CATEGORY_META, type SoundCategory } from "@/lib/ambientSounds";
import { startSynth, stopSynth, setSynthVolume } from "@/lib/pomodoroSynth";
import { END_BELLS, playEndBell, type EndBellId } from "@/lib/pomodoroSounds";
import { useTapGestures } from "@/lib/useTapGestures";
import { recordPomodoroFocusSession } from "@/lib/garden";

type Props = {
  taskId?: string | null;
  defaultMinutes?: number;
  compact?: boolean;
  onSessionComplete?: () => void;
};

const PREF_KEY = "pomodoro_prefs_v1";
type Prefs = { minutes: number; bell: EndBellId; ambient: string; ambientVol: number };

function loadPrefs(): Prefs {
  try { return { minutes: 25, bell: "bell", ambient: "none", ambientVol: 30, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }; }
  catch { return { minutes: 25, bell: "bell", ambient: "none", ambientVol: 30 }; }
}
function savePrefs(p: Prefs) { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

export default function PomodoroTimer({ taskId = null, defaultMinutes, compact = false, onSessionComplete }: Props) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs());
  const [minutes, setMinutes] = useState(defaultMinutes ?? prefs.minutes);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const startedAtRef = useRef<number | null>(null);
  const totalSecRef = useRef<number>((defaultMinutes ?? prefs.minutes) * 60);

  // sync prefs to storage
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  // Ambient/music: switch instantly when running (offline synth)
  useEffect(() => {
    if (!running) { stopSynth(); return; }
    if (prefs.ambient && prefs.ambient !== "none") {
      startSynth(prefs.ambient, prefs.ambientVol);
    } else {
      stopSynth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.ambient, running]);

  useEffect(() => {
    setSynthVolume(prefs.ambientVol);
  }, [prefs.ambientVol]);

  // Tick
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s > 0) return s - 1;
        // s === 0 → decrement minutes
        setMinutes((m) => {
          if (m > 0) return m - 1;
          // session finished
          finishSession();
          return 0;
        });
        return 59;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const finishSession = async () => {
    setRunning(false);
    stopSynth();
    playEndBell(prefs.bell);
    if (mode === "work") {
      const dur = Math.round(totalSecRef.current / 60);
      if (user) {
        await supabase.from("pomodoro_sessions").insert({
          user_id: user.id,
          task_id: taskId || null,
          duration_minutes: dur,
          completed: true,
          started_at: new Date(startedAtRef.current || Date.now() - dur * 60000).toISOString(),
          ended_at: new Date().toISOString(),
        });
      }
      recordPomodoroFocusSession(dur);
      toast.success(T(`${dur} دقیقه تمرکز ثبت شد ✅ — ۵ دقیقه استراحت`, `${dur} min focus logged ✅ — 5 min break`));
      onSessionComplete?.();
      setMode("break");
      setMinutes(5); setSeconds(0);
      totalSecRef.current = 5 * 60;
    } else {
      toast.success(T("استراحت تمام شد. آماده‌ای؟", "Break finished. Ready?"));
      setMode("work");
      setMinutes(prefs.minutes); setSeconds(0);
      totalSecRef.current = prefs.minutes * 60;
    }
  };

  const start = () => {
    if (!running) {
      if (minutes === 0 && seconds === 0) {
        setMinutes(mode === "work" ? prefs.minutes : 5);
        totalSecRef.current = (mode === "work" ? prefs.minutes : 5) * 60;
      } else {
        totalSecRef.current = minutes * 60 + seconds;
      }
      startedAtRef.current = Date.now();
      prefs.ambient && prefs.ambient !== "none" && startSynth(prefs.ambient, prefs.ambientVol);
    } else {
      stopSynth();
    }
    setRunning(!running);
  };

  const reset = () => {
    setRunning(false);
    stopSynth();
    const m = mode === "work" ? prefs.minutes : 5;
    setMinutes(m); setSeconds(0);
    totalSecRef.current = m * 60;
  };

  const onMinutesChange = (v: number) => {
    if (running) return;
    setPrefs(p => ({ ...p, minutes: v }));
    if (mode === "work") { setMinutes(v); setSeconds(0); totalSecRef.current = v * 60; }
  };

  const { handlers: timerHandlers } = useTapGestures({
    onDoubleTap: () => { haptic("light"); start(); },
    onLongPress: () => { haptic("warning"); reset(); },
  });

  const totalSeconds = (mode === "work" ? prefs.minutes : 5) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;

  // Vertical swipe ±5min, horizontal swipe → toggle work/break
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTimerTouchStart = (e: RTouchEvent) => {
    const t = e.touches[0]; if (!t) return;
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTimerTouchEnd = (e: RTouchEvent) => {
    const s = swipeStart.current; swipeStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
      if (running) return;
      const delta = dy < 0 ? 5 : -5;
      const next = Math.max(5, Math.min(90, prefs.minutes + delta));
      onMinutesChange(next);
      haptic("light");
      toast.message(T(`${next} دقیقه`, `${next} min`));
    } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (running) return;
      const newMode = mode === "work" ? "break" : "work";
      setMode(newMode);
      const m = newMode === "work" ? prefs.minutes : 5;
      setMinutes(m); setSeconds(0); totalSecRef.current = m * 60;
      haptic("medium");
      toast.message(newMode === "work" ? T("حالت تمرکز", "Focus mode") : T("حالت استراحت", "Break mode"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-1">{mode === "work" ? T("زمان تمرکز", "Focus time") : T("استراحت", "Break")}</div>
        <div
          {...timerHandlers}
          onTouchStart={(e) => { timerHandlers.onTouchStart(e); onTimerTouchStart(e); }}
          onTouchEnd={(e) => { timerHandlers.onTouchEnd(); onTimerTouchEnd(e); }}
          className={`tabular-nums font-bold text-primary ${compact ? "text-5xl" : "text-7xl"} my-3 select-none cursor-pointer`}
          title={T("دابل‌تاچ: شروع/توقف • نگه‌داشتن: ریست • سوایپ عمودی: ±۵د • سوایپ افقی: تمرکز/استراحت", "Double-tap: start/stop • Hold: reset • Vertical swipe: ±5m • Horizontal swipe: focus/break")}
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <div className="flex gap-2 justify-center">
          <Button size={compact ? "default" : "lg"} onClick={start}>
            {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button size={compact ? "default" : "lg"} variant="outline" onClick={reset}>
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
        <div className="h-2 w-full max-w-xs mx-auto bg-muted rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {!running && mode === "work" && (
        <div className="space-y-2">
          <Label className="text-xs">{T("مدت زمان", "Duration")}: {toPersianDigits(prefs.minutes)} {T("دقیقه", "min")}</Label>
          <Slider value={[prefs.minutes]} min={5} max={90} step={5} onValueChange={([v]) => onMinutesChange(v)} />
          <div className="flex flex-wrap gap-1 justify-center">
            {[15, 25, 45, 60].map(m => (
              <Button key={m} size="sm" variant={prefs.minutes === m ? "default" : "outline"}
                className="h-7 px-2 text-xs" onClick={() => onMinutesChange(m)}>
                {T(`${m}د`, `${m}m`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs flex-1">{T("صدای پایان", "End sound")}</Label>
          <Select value={prefs.bell} onValueChange={(v) => { setPrefs(p => ({ ...p, bell: v as EndBellId })); playEndBell(v as EndBellId); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {END_BELLS.map(b => <SelectItem key={b.id} value={b.id}>{b.emoji} {T(b.name, b.nameEn)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs flex-1">{T("صدای محیطی / موسیقی", "Ambient / music")}</Label>
          <Select value={prefs.ambient} onValueChange={(v) => setPrefs(p => ({ ...p, ambient: v }))}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder={T("بدون صدا", "No sound")} /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="none">🔇 {T("بدون صدا", "No sound")}</SelectItem>
              {(Object.keys(SOUND_CATEGORY_META) as SoundCategory[]).map((cat) => {
                const items = AMBIENT_SOUNDS.filter(s => s.category === cat);
                if (!items.length) return null;
                const meta = SOUND_CATEGORY_META[cat];
                return (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] text-muted-foreground border-t mt-1">
                      {meta.emoji} {T(meta.label, meta.labelEn)}
                    </div>
                    {items.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.emoji} {T(s.name, s.nameEn)}</SelectItem>
                    ))}
                  </div>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {(() => {
          const cur = AMBIENT_SOUNDS.find(s => s.id === prefs.ambient);
          if (cur?.hint) return <div className="text-[10px] text-amber-600 dark:text-amber-400 ms-1">⚠️ {T(cur.hint, cur.hintEn || cur.hint)}</div>;
          return null;
        })()}


        {prefs.ambient !== "none" && (
          <div className="flex items-center gap-2">
            {prefs.ambientVol === 0 ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-muted-foreground" />}
            <Slider value={[prefs.ambientVol]} min={0} max={100} step={5}
              onValueChange={([v]) => setPrefs(p => ({ ...p, ambientVol: v }))} className="flex-1" />
            <span className="text-xs tabular-nums w-8 text-center">{prefs.ambientVol}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
