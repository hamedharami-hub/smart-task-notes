import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles, CheckCircle2, Plus, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { callAI } from "@/lib/ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { awardWaterDrops } from "@/lib/garden";
import { haptic } from "@/lib/haptics";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  due_date?: string | null;
  folder_id?: string | null;
}

interface ProcrastinationBusterModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onStartFocus?: (taskId: string, minutes: number) => void;
}

export default function ProcrastinationBusterModal({
  task,
  open,
  onOpenChange,
  onSuccess,
  onStartFocus,
}: ProcrastinationBusterModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [microSteps, setMicroSteps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && task) {
      setMicroSteps([]);
      handleGenerateSteps();
    }
  }, [open, task?.id]);

  const handleGenerateSteps = async () => {
    if (!task) return;
    setLoading(true);
    haptic("light");
    try {
      const prompt =
        "تسک زیر به دلیل سختی یا بزرگی به تعویق افتاده است:\n" +
        `عنوان: "${task.title}"\n` +
        `توضیحات: "${task.description || "ندارد"}"\n\n` +
        "بر اساس اصول روانشناسی CBT و مقابله با اهمال‌کاری (Micro-stepping / 2-minute rule)، این تسک را دقیقاً به ۳ قدم بسیار کوچک، فوق‌العاده ساده و بدون مقاومت ذهنی که انجام هر کدام کمتر از ۲ دقیقه زمان می‌برد تقسیم کن.\n" +
        "پاسخ را به فرمت JSON برگردان:\n" +
        '{\n  "steps": [\n    "قدم اول بسیار ساده و ۲ دقیقه‌ای",\n    "قدم دوم ۲ دقیقه‌ای",\n    "قدم سوم ۲ دقیقه‌ای"\n  ]\n}';

      const res = await callAI("task_subtasks", prompt, "تقسیم تسک به ۳ ریزگام ۲ دقیقه‌ای ضد اهمال‌کاری");
      
      let parsed: { steps?: string[] } = {};
      try {
        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn("JSON parse fallback:", e);
      }

      if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        setMicroSteps(parsed.steps.slice(0, 3));
      } else {
        setMicroSteps([
          `فقط محیط و ابزار لازم برای «${task.title}» را باز کن (۱ دقیقه)`,
          "تنها اولین جمله یا اولین پارامتر این تسک را یادداشت کن (۲ دقیقه)",
          "یک تایمر ۵ دقیقه‌ای بگذار و فقط بخش اول را شروع کن (۲ دقیقه)",
        ]);
      }
      toast.success("✨ ۳ گام ضد اهمال‌کاری آماده شد!");
    } catch (err: any) {
      console.error(err);
      setMicroSteps([
        `فقط محیط و ابزار لازم برای «${task.title}» را باز کن (۱ دقیقه)`,
        "تنها اولین خط یا اولین کار کوچک این تسک را انجام بده (۲ دقیقه)",
        "تایمر ۵ دقیقه‌ای بگذار و اولین بخش را تمام کن (۲ دقیقه)",
      ]);
      toast.info("۳ گام پایه‌ای ایجاد شد.");
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (index: number, val: string) => {
    const next = [...microSteps];
    next[index] = val;
    setMicroSteps(next);
  };

  const handleAddStep = () => {
    if (microSteps.length < 5) {
      setMicroSteps([...microSteps, ""]);
    }
  };

  const handleRemoveStep = (index: number) => {
    setMicroSteps(microSteps.filter((_, i) => i !== index));
  };

  const handleSaveStepsAsSubtasks = async () => {
    if (!task || !user) return;
    const validSteps = microSteps.filter((s) => s.trim().length > 0);
    if (validSteps.length === 0) {
      toast.error("حداقل یک گام بنویسید.");
      return;
    }

    setSaving(true);
    haptic("medium");
    try {
      const inserts = validSteps.map((st, i) => ({
        user_id: user.id,
        folder_id: task.folder_id || null,
        parent_id: task.id,
        title: st.trim(),
        completed: false,
        status: "todo" as const,
        position: i,
      }));

      const { error } = await supabase.from("tasks").insert(inserts as any);
      if (error) throw error;

      awardWaterDrops(15, "شکستن سد اهمال‌کاری و ایجاد ریزگام‌های اجرایی ⚡");
      toast.success(`🎉 ${validSteps.length} ریزگام به عنوان زیرتسک ذخیره شد!`, {
        description: "سد ذهنی شکسته شد؛ اکنون اولین گام ۲ دقیقه‌ای را شروع کن!",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "خطا در ذخیره زیرتسک‌ها");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 rounded-3xl bg-card border-border/80 shadow-2xl" dir="rtl">
        <DialogHeader className="text-right space-y-2">
          <div className="flex items-center justify-between">
            <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-amber-500/30 font-bold gap-1 px-3 py-1">
              <Zap className="w-3.5 h-3.5 fill-current" />
              کپسول ضد اهمال‌کاری
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">قانون ۲ دقیقه (CBT)</span>
          </div>

          <DialogTitle className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
            شروع «{task?.title}» سخته؟
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            کاملاً طبیعیه! مغز در برابر کارهای مبهم یا بزرگ مقاومت می‌کنه. بیا این کار رو به ۳ قدمِ فوق‌العاده
            کوچیک و ۲ دقیقه‌ای تقسیم کنیم تا بدون هیچ فشاری همین الان شروعش کنی:
          </DialogDescription>
        </DialogHeader>

        {/* Micro-Steps List */}
        <div className="space-y-3 my-4">
          {loading ? (
            <div className="py-10 text-center space-y-3 bg-muted/30 rounded-2xl border border-dashed">
              <Sparkles className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground animate-pulse font-medium">
                هوش مصنوعی در حال خرد کردن تسک به گام‌های ۲ دقیقه‌ای...
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {microSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-2xl bg-muted/40 border border-border/70 hover:border-amber-500/40 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <Input
                    value={step}
                    onChange={(e) => handleStepChange(idx, e.target.value)}
                    placeholder={`گام ${idx + 1}...`}
                    className="h-8 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 px-1"
                  />
                  {microSteps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStep(idx)}
                      className="w-7 h-7 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateSteps}
                  disabled={loading}
                  className="text-xs text-amber-600 dark:text-amber-400 gap-1.5 h-8"
                >
                  <Sparkles className="w-3.5 h-3.5" /> تولید مجدد با AI
                </Button>

                {microSteps.length < 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddStep}
                    className="text-xs text-muted-foreground gap-1 h-8"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن گام
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
          {onStartFocus && task && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onStartFocus(task.id, 5);
              }}
              className="text-xs rounded-2xl gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              تایمر ۵ دقیقه‌ای شروع سریع
            </Button>
          )}

          <Button
            onClick={handleSaveStepsAsSubtasks}
            disabled={saving || loading || microSteps.length === 0}
            className="flex-1 rounded-2xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20"
          >
            <CheckCircle2 className="w-4 h-4 me-1.5" />
            {saving ? "در حال ثبت..." : "ثبت ۳ گام و شروع همین الان 🚀"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
