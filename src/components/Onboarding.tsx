import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListTodo, Heart, Timer, ArrowLeft, Sparkles, Compass } from "lucide-react";

const KEY = "onboarded_v1";

const STEPS = [
  {
    icon: ListTodo,
    color: "text-blue-500",
    title: "اولین تسک‌ات را بنویس",
    desc: "هر چیزی توی ذهنت هست را بسپار به برنامه — یک کار کوچک برای امروز اضافه کن.",
    cta: "برو به تسک‌ها",
    to: "/app/today",
  },
  {
    icon: Heart,
    color: "text-rose-500",
    title: "یک Check-in روزانه بزن",
    desc: "حال‌ت چطوره؟ تنها چند ثانیه طول می‌کشد و به مرور بینش عمیقی به‌ت می‌دهد.",
    cta: "Check-in الان",
    to: "/app/checkin",
  },
  {
    icon: Timer,
    color: "text-amber-500",
    title: "یک Pomodoro شروع کن",
    desc: "۲۵ دقیقه تمرکز خالص؛ ساده‌ترین راه برای شروع کار سخت.",
    cta: "شروع Pomodoro",
    to: "/app/pomodoro",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {}
  }, []);

  const finish = (to?: string) => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
    if (to) navigate(to);
  };

  const step = STEPS[i];
  const Icon = step.icon;
  const isLast = i === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            خوش آمدی به ARSHNAZ
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 text-center space-y-3">
          <div className={`w-14 h-14 mx-auto rounded-2xl bg-accent/40 flex items-center justify-center ${step.color}`}>
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-7">{step.desc}</p>
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-2">
          {STEPS.map((_, idx) => (
            <span key={idx}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
          ))}
        </div>
        <div className="pt-2 border-t border-border/60">
          <Button
            variant="outline"
            className="w-full gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold py-2.5 rounded-xl shadow-xs"
            onClick={() => finish("/app/life-architect")}
          >
            <Compass className="w-4 h-4" />
            طراحی هوشمند سیستم زندگی با «معمار زندگی» (پیشنهادی)
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => finish()}>رد کن</Button>
          {!isLast ? (
            <Button className="flex-1 gap-1" onClick={() => setI(i + 1)}>
              بعدی <ArrowLeft className="w-4 h-4" />
            </Button>
          ) : null}
          <Button variant={isLast ? "default" : "secondary"} className="flex-1"
            onClick={() => finish(step.to)}>
            {step.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
