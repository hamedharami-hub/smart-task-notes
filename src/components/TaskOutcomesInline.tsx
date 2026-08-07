import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, Plus } from "lucide-react";
import { listTaskOutcomes } from "@/lib/taskOutcomes";
import type { TaskOutcome } from "@/lib/taskTypes";

export function TaskOutcomesInline({
  taskId,
  onEdit,
  refreshKey = 0,
}: {
  taskId: string;
  onEdit?: () => void;
  refreshKey?: number;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [outcomes, setOutcomes] = useState<TaskOutcome[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTaskOutcomes(taskId)
      .then((data) => { if (!cancelled) setOutcomes(data); })
      .catch(() => { if (!cancelled) setOutcomes([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId, refreshKey]);

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground px-1">
        {T("در حال بارگذاری شاخه‌ها…", "Loading branches…")}
      </p>
    );
  }

  if (outcomes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          {T("هنوز شاخه‌ای تعریف نشده", "No branches defined yet")}
        </p>
        {onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="gap-1 h-7 text-xs">
            <Plus className="w-3 h-3" />
            {T("تعریف شاخه", "Define branch")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <GitBranch className="w-4 h-4" />
          {T("شاخه‌ها", "Branches")}
        </label>
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 text-xs">
            {T("ویرایش", "Edit")}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {outcomes.map((outcome) => (
          <Card key={outcome.id} className="p-2.5 space-y-1.5 bg-muted/30 rounded-xl">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                style={{ background: outcome.color || "hsl(var(--primary))", color: "#fff" }}
              >
                {outcome.icon || <GitBranch className="w-3 h-3" />}
              </span>
              <span className="text-sm font-medium truncate">{outcome.label}</span>
              <span className="ms-auto text-[10px] text-muted-foreground whitespace-nowrap">
                {outcome.actions.length} {T("اقدام", "actions")}
              </span>
            </div>
            {outcome.actions.length > 0 && (
              <ul className="space-y-1 ps-8">
                {outcome.actions.map((action, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="tabular-nums">{i + 1}.</span>
                    <span className="break-words">{action.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
