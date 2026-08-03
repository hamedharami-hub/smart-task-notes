import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Save, GitBranch, Clock, Flag, FolderInput, X } from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskOutcome, OutcomeAction } from "@/lib/taskTypes";
import { PRIORITY_META, PRIORITY_SELECTABLE, type Priority } from "@/lib/priority";
import { listTaskOutcomes, saveTaskOutcome, deleteTaskOutcome } from "@/lib/taskOutcomes";

export function TaskOutcomeSheet({
  task,
  open,
  onOpenChange,
  folders = [],
}: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders?: { id: string; name: string }[];
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [outcomes, setOutcomes] = useState<TaskOutcome[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listTaskOutcomes(task.id)
      .then(setOutcomes)
      .catch((e: unknown) => toast.error(T("خطا در بارگذاری شاخه‌ها", "Failed to load branches") + ": " + (e instanceof Error ? e.message : String(e))))
      .finally(() => setLoading(false));
    setRemovedIds([]);
  }, [open, task.id]);

  const addOutcome = () => {
    setOutcomes((prev) => [
      ...prev,
      {
        id: "",
        task_id: task.id,
        label: "",
        color: null,
        icon: null,
        position: prev.length,
        actions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TaskOutcome,
    ]);
  };

  const addPresets = () => {
    const presets = [
      { label: T("انجام شد", "It happened"), color: "hsl(142 70% 40%)", icon: "✅" },
      { label: T("انجام نشد", "It did not happen"), color: "hsl(0 72% 51%)", icon: "❌" },
      { label: T("یک اتفاق دیگر افتاد", "Something else happened"), color: "hsl(38 92% 50%)", icon: "🔀" },
    ];
    setOutcomes((prev) => [
      ...prev,
      ...presets.map((p, i) => ({
        id: "",
        task_id: task.id,
        label: p.label,
        color: p.color,
        icon: p.icon,
        position: prev.length + i,
        actions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) as TaskOutcome[],
    ]);
  };

  const removeOutcome = (idx: number) => {
    setOutcomes((prev) => {
      const target = prev[idx];
      if (target?.id) setRemovedIds((ids) => [...ids, target.id]);
      const next = prev.filter((_, i) => i !== idx);
      return next.map((o, i) => ({ ...o, position: i }));
    });
  };

  const updateOutcome = (idx: number, patch: Partial<TaskOutcome>) => {
    setOutcomes((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const addAction = (idx: number) => {
    const newAction: OutcomeAction = {
      title: "",
      description: "",
      priority: "none",
      folder_id: null,
      due_offset_hours: null,
    };
    setOutcomes((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, actions: [...o.actions, newAction] } : o))
    );
  };

  const removeAction = (outcomeIdx: number, actionIdx: number) => {
    setOutcomes((prev) =>
      prev.map((o, i) =>
        i === outcomeIdx ? { ...o, actions: o.actions.filter((_, ai) => ai !== actionIdx) } : o
      )
    );
  };

  const updateAction = (outcomeIdx: number, actionIdx: number, patch: Partial<OutcomeAction>) => {
    setOutcomes((prev) =>
      prev.map((o, i) =>
        i === outcomeIdx
          ? {
              ...o,
              actions: o.actions.map((a, ai) => (ai === actionIdx ? { ...a, ...patch } : a)),
            }
          : o
      )
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < outcomes.length; i++) {
        const o = outcomes[i];
        if (!o.label.trim()) continue;
        await saveTaskOutcome({
          id: o.id || undefined,
          task_id: task.id,
          label: o.label,
          color: o.color,
          icon: o.icon,
          position: i,
          actions: o.actions.filter((a) => a.title.trim()).map((a) => ({
            ...a,
            due_offset_hours: a.due_offset_hours ? Number(a.due_offset_hours) : null,
          })),
        });
      }
      for (const id of removedIds) {
        await deleteTaskOutcome(id);
      }
      toast.success(T("ذخیره شد", "Saved"));
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(T("خطا در ذخیره شاخه‌ها", "Failed to save branches") + ": " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col rounded-t-2xl">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            {T("سناریوهای وابسته", "Conditional outcomes")}
          </SheetTitle>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1">
            {saving ? <span className="animate-spin">↻</span> : <Save className="w-4 h-4" />}
            {T("ذخیره", "Save")}
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">{T("در حال بارگذاری…", "Loading…")}</p>}

          {outcomes.map((outcome, oi) => (
            <Card key={oi} className="p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Input
                  value={outcome.label}
                  onChange={(e) => updateOutcome(oi, { label: e.target.value })}
                  placeholder={T("اگر … (مثلاً: جواب داد)", "If … (e.g. Answered)")}
                  className="flex-1 font-medium"
                />
                <Button size="icon" variant="ghost" onClick={() => removeOutcome(oi)} className="text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {outcome.actions.map((action, ai) => (
                  <div key={ai} className="rounded-lg border p-2 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input
                        value={action.title}
                        onChange={(e) => updateAction(oi, ai, { title: e.target.value })}
                        placeholder={T("آنگاه این کار انجام شود…", "Then do this task…")}
                        className="flex-1 text-sm"
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeAction(oi, ai)} className="h-8 w-8 text-muted-foreground">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={action.description || ""}
                      onChange={(e) => updateAction(oi, ai, { description: e.target.value })}
                      placeholder={T("توضیحات (اختیاری)", "Description (optional)")}
                      className="text-xs"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={action.priority || "none"}
                        onChange={(e) => updateAction(oi, ai, { priority: e.target.value as Priority })}
                        className="h-8 text-xs rounded-md border border-input bg-background px-2"
                      >
                        {PRIORITY_SELECTABLE.map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY_META[p].emoji} {T(PRIORITY_META[p].label, PRIORITY_META[p].labelEn)}
                          </option>
                        ))}
                        <option value="none">{T("بدون اولویت", "No priority")}</option>
                      </select>
                      <select
                        value={action.folder_id || ""}
                        onChange={(e) => updateAction(oi, ai, { folder_id: e.target.value || null })}
                        className="h-8 text-xs rounded-md border border-input bg-background px-2"
                      >
                        <option value="">{T("فولدر والد", "Parent folder")}</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <Input
                          type="number"
                          value={action.due_offset_hours ?? ""}
                          onChange={(e) => updateAction(oi, ai, { due_offset_hours: e.target.value ? Number(e.target.value) : null })}
                          placeholder={T("ساعت", "hrs")}
                          className="h-8 w-20 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addAction(oi)}
                  className="gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {T("افزودن تسک به این حالت", "Add task to this outcome")}
                </Button>
              </div>
            </Card>
          ))}

          {!loading && outcomes.length === 0 && (
            <div className="rounded-xl border border-dashed p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {T(
                  "برای این تسک شاخه بساز: «اگر این اتفاق افتاد، این کارها را انجام بده».",
                  "Add branches: “if this happens, then do these tasks”.",
                )}
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={addPresets} className="gap-1">
                <Plus className="w-4 h-4" />
                {T("افزودن سه شاخه پیش‌فرض", "Add 3 default branches")}
              </Button>
            </div>
          )}

          <Button type="button" variant="outline" onClick={addOutcome} className="w-full gap-1">
            <Plus className="w-4 h-4" />
            {T("افزودن حالت جدید", "Add new outcome")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
