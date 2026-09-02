import React, { useRef } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type GoalKanban,
  type TimeHorizon,
  type GoalPriority,
  TIME_HORIZONS,
  GOAL_PRIORITIES,
} from "@/lib/kanbanGoals";

interface MultiTierTabsProps {
  goals: GoalKanban[];
  selectedGoalId: string | null;
  viewMode: "hierarchy" | "time" | "priority";
  selectedTimeFilter: TimeHorizon | "all";
  selectedPriorityFilter: GoalPriority | "all";
  onSelectGoal: (id: string) => void;
  onSelectTimeFilter: (horizon: TimeHorizon | "all") => void;
  onSelectPriorityFilter: (priority: GoalPriority | "all") => void;
  onDoubleTapGoal: (goal: GoalKanban) => void;
  onAddNewGoal: () => void;
  taskCountsByGoal: Record<string, number>;
}

/** Single-tier goal tabs: one flat row of goals, optionally filtered by time or priority. */
export default function MultiTierTabs({
  goals,
  selectedGoalId,
  viewMode,
  selectedTimeFilter,
  selectedPriorityFilter,
  onSelectGoal,
  onSelectTimeFilter,
  onSelectPriorityFilter,
  onDoubleTapGoal,
  onAddNewGoal,
  taskCountsByGoal,
}: MultiTierTabsProps) {
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const handleTabTouch = (goal: GoalKanban, singleAction: () => void) => {
    const now = Date.now();
    if (lastTapRef.current.id === goal.id && now - lastTapRef.current.time < 350) {
      onDoubleTapGoal(goal);
      lastTapRef.current = { id: "", time: 0 };
    } else {
      lastTapRef.current = { id: goal.id, time: now };
      singleAction();
    }
  };

  const filteredGoals =
    viewMode === "time"
      ? selectedTimeFilter === "all"
        ? goals
        : goals.filter((g) => g.timeHorizon === selectedTimeFilter)
      : viewMode === "priority"
        ? selectedPriorityFilter === "all"
          ? goals
          : goals.filter((g) => g.priority === selectedPriorityFilter)
        : goals;

  return (
    <div className="space-y-2 select-none" dir="rtl">
      {/* Optional filter row (time / priority modes) */}
      {viewMode === "time" && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => onSelectTimeFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedTimeFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            همه بازه‌ها
          </button>
          {TIME_HORIZONS.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => onSelectTimeFilter(th.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                selectedTimeFilter === th.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{th.icon}</span>
              <span>{th.labelFa}</span>
            </button>
          ))}
        </div>
      )}

      {viewMode === "priority" && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => onSelectPriorityFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedPriorityFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            همه اولویت‌ها
          </button>
          {GOAL_PRIORITIES.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => onSelectPriorityFilter(pr.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                selectedPriorityFilter === pr.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{pr.badge}</span>
              <span>{pr.labelFa}</span>
            </button>
          ))}
        </div>
      )}

      {/* Single flat row of goals */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {filteredGoals.map((g) => {
          const isSelected = selectedGoalId === g.id;
          const count = taskCountsByGoal[g.id] || 0;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => handleTabTouch(g, () => onSelectGoal(g.id))}
              onDoubleClick={() => onDoubleTapGoal(g)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                isSelected
                  ? "bg-card border-primary text-primary shadow-sm ring-1 ring-primary"
                  : "bg-muted/60 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-base">{g.icon || "🎯"}</span>
              <span>{g.title}</span>
              {count > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4 rounded-full">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAddNewGoal()}
          className="h-8 px-2.5 rounded-2xl text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 bg-muted/30"
        >
          <Plus className="w-3.5 h-3.5" /> هدف جدید
        </Button>
      </div>
    </div>
  );
}
