import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { toast } from "sonner";
import {
  Sparkles, ArrowLeft, ArrowRight, Check, Compass, RefreshCw, Zap,
  Target, Folder, Brain, Clock, ShieldCheck, Flame, Award, ChevronRight
} from "lucide-react";
import {
  WIZARD_QUESTIONS,
  generateDeterministicBlueprint,
  enhanceBlueprintWithAI,
  auditExistingSystem,
  deployLifeBlueprint,
  type UserAnswers,
  type LifeBlueprint,
  type SystemAuditResult,
} from "@/lib/lifeArchitect";

export default function LifeArchitectView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [mode, setMode] = useState<"welcome" | "wizard" | "audit" | "generating" | "review">("welcome");
  const [stepIdx, setStepIdx] = useState(0);

  const [answers, setAnswers] = useState<UserAnswers>({
    role: "freelancer",
    obstacle: "procrastination",
    domains: ["career", "health", "growth"],
    chronotype: "morning",
    customGoals: "",
  });

  const [blueprint, setBlueprint] = useState<LifeBlueprint | null>(null);
  const [auditResult, setAuditResult] = useState<SystemAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedHabitNames, setSelectedHabitNames] = useState<Set<string>>(new Set());
  const [selectedTaskTitles, setSelectedTaskTitles] = useState<Set<string>>(new Set());

  const currentQuestion = WIZARD_QUESTIONS[stepIdx];
  const isLastQuestion = stepIdx === WIZARD_QUESTIONS.length - 1;

  const startWizard = () => {
    setStepIdx(0);
    setMode("wizard");
  };

  const startAudit = async () => {
    if (!user) return toast.error(T("لطفاً وارد حساب خود شوید", "Please sign in"));
    setIsAuditing(true);
    setMode("audit");
    try {
      const res = await auditExistingSystem(user.id);
      setAuditResult(res);
    } catch (err: any) {
      toast.error(err.message || T("خطا در ممیزی سیستم", "Error auditing system"));
      setMode("welcome");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSelectOption = (value: string) => {
    const qId = currentQuestion.id;
    if (currentQuestion.isMultiSelect) {
      const currentArr = (answers[qId] as string[]) || [];
      let nextArr: string[];
      if (currentArr.includes(value)) {
        if (currentArr.length <= 1) {
          toast.warning(T("حداقل یک حوزه باید انتخاب شود", "Select at least one domain"));
          return;
        }
        nextArr = currentArr.filter((x) => x !== value);
      } else {
        if (currentArr.length >= 3) {
          toast.info(T("حداکثر ۳ حوزه اصلی برای حفظ تمرکز", "Maximum 3 domains for focus"));
          return;
        }
        nextArr = [...currentArr, value];
      }
      setAnswers((prev) => ({ ...prev, [qId]: nextArr }));
    } else {
      setAnswers((prev) => ({ ...prev, [qId]: value }));
    }
  };

  const handleNext = async () => {
    if (!isLastQuestion) {
      setStepIdx((prev) => prev + 1);
    } else {
      setMode("generating");
      const baseBp = generateDeterministicBlueprint(answers);
      const finalBp = await enhanceBlueprintWithAI(answers, baseBp);
      setBlueprint(finalBp);

      setSelectedFolderIds(new Set(finalBp.folders.map((f) => f.id)));
      setSelectedHabitNames(new Set(finalBp.habits.map((h) => h.name)));
      setSelectedTaskTitles(new Set(finalBp.tasks.map((t) => t.title)));

      setMode("review");
    }
  };

  const handlePrev = () => {
    if (stepIdx > 0) setStepIdx((prev) => prev - 1);
    else setMode("welcome");
  };

  const handleDeploy = async () => {
    if (!user || !blueprint) return;
    setIsDeploying(true);
    try {
      const { foldersCount, habitsCount, tasksCount } = await deployLifeBlueprint(
        blueprint,
        user.id,
        selectedFolderIds,
        selectedHabitNames,
        selectedTaskTitles
      );

      toast.success(
        T(
          `سیستم با موفقیت مستقر شد! (${foldersCount} فولدر، ${habitsCount} عادت، ${tasksCount} تسک)`,
          `System deployed! (${foldersCount} folders, ${habitsCount} habits, ${tasksCount} tasks)`
        )
      );

      setTimeout(() => navigate("/app/today"), 1200);
    } catch (err: any) {
      toast.error(err.message || T("خطا در استقرار سیستم", "Error deploying system"));
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeployAuditRecommendations = async () => {
    if (!user || !auditResult) return;
    setIsDeploying(true);
    try {
      const auditBp: LifeBlueprint = {
        title: "پچ‌های بهینه‌سازی سیستم",
        summary: "ارتقای توازن زندگی و سازمان‌دهی اینباکس",
        scientificInsight: "تکمیل حلقه‌های باز ذهنی با فولدرها و عادات گمشده.",
        folders: auditResult.recommendations.addFolders,
        goals: auditResult.recommendations.addGoals,
        habits: auditResult.recommendations.addHabits,
        tasks: [],
        recommendedWorkflow: "list",
      };

      const res = await deployLifeBlueprint(auditBp, user.id);
      toast.success(
        T(
          `بهینه‌سازی با موفقیت اعمال شد (${res.foldersCount} پوشه جدید، ${res.habitsCount} عادت)`,
          `Optimizations applied (${res.foldersCount} new folders, ${res.habitsCount} habits)`
        )
      );
      setTimeout(() => navigate("/app/today"), 1200);
    } catch (err: any) {
      toast.error(err.message || T("خطا در اعمال تغییرات", "Error applying changes"));
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24 min-h-[85vh] flex flex-col justify-center" dir={isEn ? "ltr" : "rtl"}>
      {mode === "welcome" && (
        <div className="space-y-6 text-center animate-fade-in py-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/25 ring-8 ring-primary/10">
            <Compass className="w-10 h-10 animate-spin-slow" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <Badge variant="outline" className="px-3 py-1 gap-1 text-xs border-primary/30 text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              {T("طراح و معمار هوشمند بهره‌وری", "Smart Life Architect")}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              {T("سیستم‌عامل اختصاصی زندگی‌ات را بساز", "Build Your Personal Life Operating System")}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {T(
                "به جای سردرگمی در برنامه‌های خالی، با چند پاسخ ساده مبتنی بر علوم اعصاب و روانشناسی رفتاری، ساختار پوشه‌ها، اهداف و عاداتت را در ۲ دقیقه بچین.",
                "Instead of staring at a blank app, design your folders, multi-tier goals, and habits in 2 minutes based on behavioral neuroscience."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-4 text-start">
            <Card
              onClick={startWizard}
              className="p-5 cursor-pointer hover:border-primary/60 hover:shadow-lg transition-all group relative overflow-hidden bg-card/70 border-border/70"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base mb-1 text-foreground flex items-center gap-1.5">
                {T("شروع از نقطه صفر", "Start from Scratch")}
                <ChevronRight className="w-4 h-4 ms-auto text-muted-foreground group-hover:translate-x-[-4px] transition-transform rtl:rotate-180" />
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {T(
                  "مناسب برای ساخت سیستم تازه؛ انتخاب نقش، حوزه‌های تمرکز فصلی و تولید کامل پوشه‌ها و اهداف.",
                  "Perfect for a fresh start: select your role, focus areas, and get a complete blueprint."
                )}
              </p>
            </Card>

            <Card
              onClick={startAudit}
              className="p-5 cursor-pointer hover:border-amber-500/60 hover:shadow-lg transition-all group relative overflow-hidden bg-card/70 border-border/70"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base mb-1 text-foreground flex items-center gap-1.5">
                {T("عارضه‌یابی و تکمیل برنامه فعلی", "Audit & Upgrade System")}
                <ChevronRight className="w-4 h-4 ms-auto text-muted-foreground group-hover:translate-x-[-4px] transition-transform rtl:rotate-180" />
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {T(
                  "تحلیل تسک‌ها و پوشه‌های کنونی شما، سنجش توازن چرخ زندگی و پیشنهاد بهبود بدون حذف هیچ دیتایی.",
                  "Analyze your current tasks and folders, evaluate life wheel balance, and upgrade without losing data."
                )}
              </p>
            </Card>
          </div>
        </div>
      )}

      {mode === "wizard" && currentQuestion && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="gap-1 text-xs">
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              {T("قبلی", "Back")}
            </Button>
            <div className="flex items-center gap-1.5">
              {WIZARD_QUESTIONS.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === stepIdx ? "w-8 bg-primary" : idx < stepIdx ? "w-2.5 bg-primary/40" : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {stepIdx + 1} / {WIZARD_QUESTIONS.length}
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-foreground">{currentQuestion.titleFa}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{currentQuestion.subtitleFa}</p>
          </div>

          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-xs text-foreground/90">
            <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-primary ms-1">{T("بینش علمی روانشناسی:", "Scientific Insight:")}</span>
              {currentQuestion.scientificInsightFa}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQuestion.options.map((opt) => {
              const selectedValue = answers[currentQuestion.id];
              const isSelected = currentQuestion.isMultiSelect
                ? Array.isArray(selectedValue) && selectedValue.includes(opt.value)
                : selectedValue === opt.value;

              return (
                <Card
                  key={opt.value}
                  onClick={() => handleSelectOption(opt.value)}
                  className={`p-3.5 cursor-pointer rounded-2xl border transition-all text-start flex items-start gap-3 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                      : "border-border/60 hover:bg-accent/40 bg-card/60"
                  }`}
                >
                  <span className="text-2xl shrink-0 select-none p-1">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-bold text-sm text-foreground truncate">{opt.labelFa}</span>
                      {opt.badge && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                          {opt.badge}
                        </Badge>
                      )}
                      {isSelected && <Check className="w-4 h-4 ms-auto text-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{opt.descFa}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          {isLastQuestion && (
            <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-primary" />
                  {T("پروژه یا دغدغه خاصی در ذهن داری؟ (اختیاری)", "Any specific goal or project in mind? (Optional)")}
                </label>
                <VoiceInputButton
                  onTranscript={(text) =>
                    setAnswers((prev) => ({
                      ...prev,
                      customGoals: prev.customGoals ? prev.customGoals + " " + text : text,
                    }))
                  }
                  size="sm"
                  className="h-8 text-xs"
                />
              </div>
              <AutoTextarea
                value={answers.customGoals || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, customGoals: e.target.value }))}
                placeholder={T(
                  "مثلاً: می‌خوام تا ۳ ماه آینده فروشگاه آنلاینم را راه‌اندازی کنم و برای آزمون زبان هم آماده بشم...",
                  "e.g., I want to launch my online store in 3 months and prepare for my language test..."
                )}
                className="text-xs bg-muted/40 min-h-[60px]"
                rows={2}
                dir="auto"
              />
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <Button onClick={handleNext} className="gap-2 px-6 rounded-xl shadow-md shadow-primary/25">
              {isLastQuestion ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  {T("طراحی نقشه اختصاصی من", "Generate My Blueprint")}
                </>
              ) : (
                <>
                  {T("مرحله بعدی", "Next Step")}
                  <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {mode === "generating" && (
        <div className="text-center py-16 space-y-5 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
            <Sparkles className="w-10 h-10 animate-spin-slow" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {T("در حال معماری و تلفیق روانشناختی...", "Architecting your personal system...")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {T(
                "هوش مصنوعی و الگوریتم‌های رفتاری در حال چیدمان بهینه پوشه‌ها، اهداف چندسطحی و عادات روزمره شما هستند.",
                "AI and behavioral algorithms are structuring your folders, goals, and daily rhythms."
              )}
            </p>
          </div>
        </div>
      )}

      {mode === "audit" && (
        <div className="space-y-6 animate-fade-in">
          {isAuditing ? (
            <div className="text-center py-16 space-y-4">
              <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
              <h3 className="text-lg font-bold">{T("در حال ممیزی سیستم و تسک‌های شما...", "Auditing your system...")}</h3>
            </div>
          ) : auditResult ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setMode("welcome")} className="gap-1 text-xs">
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  {T("بازگشت", "Back")}
                </Button>
                <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                  {T("گزارش سلامت سیستم", "System Health Report")}
                </Badge>
              </div>

              <Card className="p-5 rounded-2xl bg-gradient-to-tr from-card to-accent/20 border-border/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{T("نمره تعادل سیستم شما", "System Balance Score")}</h2>
                    <p className="text-xs text-muted-foreground">
                      {T(`بر اساس ${auditResult.totalTasks} تسک، ${auditResult.totalFolders} پوشه و ${auditResult.totalHabits} عادت فعلی`, `Based on ${auditResult.totalTasks} tasks, ${auditResult.totalFolders} folders, ${auditResult.totalHabits} habits`)}
                    </p>
                  </div>
                  <div className="text-3xl font-black text-primary font-mono">{auditResult.healthScore}%</div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <h4 className="text-xs font-semibold text-muted-foreground">{T("توازن چرخ زندگی (Wheel of Life):", "Wheel of Life Balance:")}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {Object.entries(auditResult.wheelBalance).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-xl bg-background/70 border border-border/40">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{key}</span>
                          <span className="text-muted-foreground">{val}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(5, val)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="p-4 rounded-2xl bg-emerald-500/5 border-emerald-500/20 space-y-2">
                  <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {T("نقاط قوت سیستم فعلی", "System Strengths")}
                  </h3>
                  <ul className="text-xs text-foreground/80 space-y-1 list-disc list-inside">
                    {auditResult.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-4 rounded-2xl bg-amber-500/5 border-amber-500/20 space-y-2">
                  <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    {T("حلقه‌های باز و موارد نیازمند ارتقا", "Improvement Opportunities")}
                  </h3>
                  <ul className="text-xs text-foreground/80 space-y-1 list-disc list-inside">
                    {auditResult.gaps.map((g, idx) => (
                      <li key={idx}>{g}</li>
                    ))}
                  </ul>
                </Card>
              </div>

              {(auditResult.recommendations.addFolders.length > 0 || auditResult.recommendations.addHabits.length > 0) && (
                <Card className="p-4 rounded-2xl border-primary/30 bg-primary/5 space-y-3">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {T("بسته‌ی پیشنهادی برای تکمیل سیستم (بدون حذف داده‌های قبلی):", "Recommended Additions (Additive only):")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {auditResult.recommendations.addFolders.map((f) => (
                      <Badge key={f.id} variant="secondary" className="px-2.5 py-1 text-xs gap-1">
                        <Folder className="w-3 h-3 text-primary" /> {f.name}
                      </Badge>
                    ))}
                    {auditResult.recommendations.addHabits.map((h, i) => (
                      <Badge key={i} variant="outline" className="px-2.5 py-1 text-xs gap-1 border-primary/40">
                        <Flame className="w-3 h-3 text-amber-500" /> {h.name}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    onClick={handleDeployAuditRecommendations}
                    disabled={isDeploying}
                    className="w-full sm:w-auto gap-2 rounded-xl mt-2 shadow-md shadow-primary/20"
                  >
                    <Check className="w-4 h-4" />
                    {T("اعمال بسته‌ی بهینه‌سازی به سیستم من", "Apply Recommendations to My System")}
                  </Button>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      )}

      {mode === "review" && blueprint && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setMode("wizard")} className="gap-1 text-xs">
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              {T("ویرایش پاسخ‌ها", "Edit Answers")}
            </Button>
            <Badge variant="outline" className="text-primary border-primary/30 gap-1">
              <Award className="w-3.5 h-3.5" />
              {T("طرح پیشنهادی معمار زندگی", "Proposed Life Blueprint")}
            </Badge>
          </div>

          {(() => {
            const roleOpt = WIZARD_QUESTIONS.find((q) => q.id === "role")?.options.find((o) => o.value === answers.role);
            const obstacleOpt = WIZARD_QUESTIONS.find((q) => q.id === "obstacle")?.options.find((o) => o.value === answers.obstacle);
            const chronotypeOpt = WIZARD_QUESTIONS.find((q) => q.id === "chronotype")?.options.find((o) => o.value === answers.chronotype);
            const domainOpts = WIZARD_QUESTIONS.find((q) => q.id === "domains")?.options.filter((o) => answers.domains.includes(o.value as any)) || [];

            return (
              <Card className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-card via-card/95 to-primary/10 border-primary/25 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/40 text-primary font-bold text-xs gap-1 py-1 px-2.5 bg-primary/5">
                    <Compass className="w-3.5 h-3.5" />
                    {T("طرح معماری اختصاصی", "Custom Architecture Blueprint")}
                  </Badge>
                  {roleOpt && (
                    <Badge className="bg-blue-500/15 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold gap-1 py-1">
                      <span>{roleOpt.icon}</span> {roleOpt.labelFa}
                    </Badge>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {blueprint.title}
                </h2>

                <div className="p-4 rounded-2xl bg-background/70 border border-border/60 text-xs sm:text-sm leading-8 text-foreground/90 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    {T("ترکیب هوشمند بر اساس پاسخ‌های شما:", "Smart synthesis based on your selections:")}
                  </div>
                  <p className="leading-8">
                    {T("این ساختار اختصاصی بر اساس نقش زندگی شما به عنوان ", "This custom architecture is based on your role as ")}
                    <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mx-1 shadow-2xs">
                      <span>{roleOpt?.icon || "🚀"}</span>
                      {roleOpt?.labelFa.split("/")[0].trim() || answers.role}
                    </span>
                    {T("، با هدف غلبه بر چالش اصلی ", ", designed to overcome ")}
                    <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mx-1 shadow-2xs">
                      <span>{obstacleOpt?.icon || "⏳"}</span>
                      {obstacleOpt?.labelFa.split("(")[0].trim() || answers.obstacle}
                    </span>
                    {T("، با تمرکز راهبردی بر ۳ حوزه کلیدی ", ", with strategic focus on ")}
                    {domainOpts.map((d, i) => (
                      <span key={i} className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mx-1 shadow-2xs">
                        <span>{d.icon}</span>
                        {d.labelFa.split("،")[0].trim()}
                      </span>
                    ))}
                    {T(" و هماهنگ با ساعت طلایی انرژی شما ", " and aligned with your peak energy window ")}
                    <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mx-1 shadow-2xs">
                      <span>{chronotypeOpt?.icon || "🌅"}</span>
                      {chronotypeOpt?.labelFa.split("(")[0].trim() || answers.chronotype}
                    </span>
                    {T(" پیکربندی شده است.", ".")}
                  </p>

                  {answers.customGoals && answers.customGoals.trim() && (
                    <div className="pt-2 mt-2 border-t border-border/40 flex items-start gap-2 text-xs">
                      <Target className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-muted-foreground">{T("هدف ویژه شما: ", "Your special goal: ")}</span>
                        <span className="font-bold text-pink-600 dark:text-pink-400 bg-pink-500/15 border border-pink-500/30 px-2 py-0.5 rounded-md inline-block">
                          {answers.customGoals.trim()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-2.5 text-xs text-foreground">
                  <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{blueprint.scientificInsight}</div>
                </div>
              </Card>
            );
          })()}

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Folder className="w-3.5 h-3.5 text-primary" />
                {T("پوشه‌های اصلی زندگی (Folders):", "Core Life Folders:")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {blueprint.folders.map((f) => {
                  const isChecked = selectedFolderIds.has(f.id);
                  return (
                    <Card
                      key={f.id}
                      onClick={() => {
                        const next = new Set(selectedFolderIds);
                        if (isChecked) next.delete(f.id);
                        else next.add(f.id);
                        setSelectedFolderIds(next);
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        isChecked ? "bg-card border-primary/50 shadow-xs" : "opacity-50 bg-muted/30"
                      }`}
                    >
                      <Checkbox checked={isChecked} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-foreground truncate">{f.name}</div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{f.description}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                {T("عادت‌های ریتم روزانه (Habits):", "Daily Rhythm Habits:")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {blueprint.habits.map((h, idx) => {
                  const isChecked = selectedHabitNames.has(h.name);
                  return (
                    <Card
                      key={idx}
                      onClick={() => {
                        const next = new Set(selectedHabitNames);
                        if (isChecked) next.delete(h.name);
                        else next.add(h.name);
                        setSelectedHabitNames(next);
                      }}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        isChecked ? "bg-card border-amber-500/50 shadow-xs" : "opacity-50 bg-muted/30"
                      }`}
                    >
                      <Checkbox checked={isChecked} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-foreground">{h.name}</span>
                          {h.reminder_time && (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                              <Clock className="w-2.5 h-2.5 me-0.5" />
                              {h.reminder_time}
                            </Badge>
                          )}
                        </div>
                        {h.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{h.description}</p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Target className="w-3.5 h-3.5 text-blue-500" />
                {T("تسک‌های هفته اول برای شکستن یخ شروع:", "First Week Starter Tasks:")}
              </h3>
              <div className="space-y-1.5">
                {blueprint.tasks.map((t, idx) => {
                  const isChecked = selectedTaskTitles.has(t.title);
                  return (
                    <Card
                      key={idx}
                      onClick={() => {
                        const next = new Set(selectedTaskTitles);
                        if (isChecked) next.delete(t.title);
                        else next.add(t.title);
                        setSelectedTaskTitles(next);
                      }}
                      className={`p-2.5 px-3 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                        isChecked ? "bg-card border-border/70" : "opacity-50 bg-muted/30"
                      }`}
                    >
                      <Checkbox checked={isChecked} />
                      <span className="text-xs font-medium text-foreground flex-1 truncate">{t.title}</span>
                      {t.priority && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                          {t.priority}
                        </Badge>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-3">
            <div className="text-xs text-muted-foreground">
              {T(
                "آیتم‌های تیک‌خورده به صورت خودکار در برنامه شما ایجاد می‌شوند.",
                "Selected items will be automatically created in your app."
              )}
            </div>
            <Button
              size="lg"
              onClick={handleDeploy}
              disabled={isDeploying}
              className="w-full sm:w-auto gap-2 px-8 rounded-2xl bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/30 font-bold"
            >
              <Sparkles className="w-5 h-5" />
              {isDeploying
                ? T("در حال استقرار سیستم...", "Deploying System...")
                : T("استقرار و ساخت سیستم در برنامه", "Deploy System into My App")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
