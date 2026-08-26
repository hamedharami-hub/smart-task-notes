import React, { useRef } from "react";
import { Plus, ChevronLeft, Calendar, Flag, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type GoalKanban,
  type TimeHorizon,
  type GoalPriority,
  TIME_HORIZONS,
  GOAL_PRIORITIES,
  getChildGoals,
} from "@/lib/kanbanGoals";

interface MultiTierTabsProps {
  goals: GoalKanban[];
  selectedTier1Id: string | null;
  selectedTier2Id: string | null;
  selectedTier3Id: string | null;
  viewMode: "hierarchy" | "time" | "priority";
  selectedTimeFilter: TimeHorizon | "all";
  selectedPriorityFilter: GoalPriority | "all";
  onSelectTier1: (id: string) => void;
  onSelectTier2: (id: string | null) => void;
  onSelectTier3: (id: string | null) => void;
  onSelectTimeFilter: (horizon: TimeHorizon | "all") => void;
  onSelectPriorityFilter: (priority: GoalPriority | "all") => void;
  onDoubleTapGoal: (goal: GoalKanban) => void;
  onAddNewGoal: (parentId: string | null) => void;
  taskCountsByGoal: Record<string, number>;
}

export default function MultiTierTabs({
  goals,
  selectedTier1Id,
  selectedTier2Id,
  selectedTier3Id,
  viewMode,
  selectedTimeFilter,
  selectedPriorityFilter,
  onSelectTier1,
  onSelectTier2,
  onSelectTier3,
  onSelectTimeFilter,
  onSelectPriorityFilter,
  onDoubleTapGoal,
  onAddNewGoal,
  taskCountsByGoal,
}: MultiTierTabsProps) {
  // Double-tap tracking for mobile touch screens
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

  // --- 1. TIME HORIZON MODE ---
  if (viewMode === "time") {
    const filteredGoals =
      selectedTimeFilter === "all"
        ? goals
        : goals.filter((g) => g.timeHorizon === selectedTimeFilter);

    return (
      <div className="space-y-2 select-none" dir="rtl">
        {/* Time Tabs Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => onSelectTimeFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedTimeFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm scale-105"
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
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{th.icon}</span>
              <span>{th.labelFa}</span>
            </button>
          ))}
        </div>

        {/* Goals belonging to selected Time Horizon */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 ps-1 border-t border-border/40">
          {filteredGoals.map((g) => {
            const isSelected = selectedTier1Id === g.id;
            const count = taskCountsByGoal[g.id] || 0;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleTabTouch(g, () => onSelectTier1(g.id))}
                onDoubleClick={() => onDoubleTapGoal(g)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                  isSelected
                    ? "bg-card border-primary text-primary shadow-sm ring-1 ring-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{g.icon || "🎯"}</span>
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
            onClick={() => onAddNewGoal(null)}
            className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> هدف جدید
          </Button>
        </div>
      </div>
    );
  }

  // --- 2. PRIORITY MODE ---
  if (viewMode === "priority") {
    const filteredGoals =
      selectedPriorityFilter === "all"
        ? goals
        : goals.filter((g) => g.priority === selectedPriorityFilter);

    return (
      <div className="space-y-2 select-none" dir="rtl">
        {/* Priority Tabs Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => onSelectPriorityFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              selectedPriorityFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm scale-105"
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
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{pr.badge}</span>
              <span>{pr.labelFa}</span>
            </button>
          ))}
        </div>

        {/* Goals for selected priority */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 ps-1 border-t border-border/40">
          {filteredGoals.map((g) => {
            const isSelected = selectedTier1Id === g.id;
            const count = taskCountsByGoal[g.id] || 0;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleTabTouch(g, () => onSelectTier1(g.id))}
                onDoubleClick={() => onDoubleTapGoal(g)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                  isSelected
                    ? "bg-card border-primary text-primary shadow-sm ring-1 ring-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{g.icon || "🎯"}</span>
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
            onClick={() => onAddNewGoal(null)}
            className="h-7 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> هدف جدید
          </Button>
        </div>
      </div>
    );
  }

  // --- 3. NATURAL HIERARCHICAL MODE (Multi-Tier Tabs) ---
  const tier1Goals = getChildGoals(goals, null);
  const tier2Goals = selectedTier1Id ? getChildGoals(goals, selectedTier1Id) : [];
  const tier3Goals = selectedTier2Id ? getChildGoals(goals, selectedTier2Id) : [];

  return (
    <div className="space-y-2 select-none" dir="rtl">
      {/* TIER 1: Root Kanbans / Goals */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {tier1Goals.map((g) => {
          const isSelected = selectedTier1Id === g.id;
          const count = taskCountsByGoal[g.id] || 0;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() =>
                handleTabTouch(g, () => {
                  onSelectTier1(g.id);
                  onSelectTier2(null);
                  onSelectTier3(null);
                })
              }
              onDoubleClick={() => onDoubleTapGoal(g)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                isSelected
                  ? "bg-card border-primary text-primary shadow-sm ring-1 ring-primary scale-[1.02]"
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
          onClick={() => onAddNewGoal(null)}
          className="h-8 px-2.5 rounded-2xl text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1 bg-muted/30"
        >
          <Plus className="w-3.5 h-3.5" /> کانبان جدید
        </Button>
      </div>

      {/* TIER 2: Sub-Goals / Sub-Sections of Tier 1 (Shown directly beneath) */}
      {selectedTier1Id && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 ps-2 border-t border-border/40 animate-fade-in">
          {/* Default "Not Sectioned / All" tab */}
          <button
            type="button"
            onClick={() => {
              onSelectTier2(null);
              onSelectTier3(null);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-all shrink-0 border ${
              selectedTier2Id === null
                ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            بدون دسته‌بندی (Not Sectioned)
          </button>

          {tier2Goals.map((g) => {
            const isSelected = selectedTier2Id === g.id;
            const count = taskCountsByGoal[g.id] || 0;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  handleTabTouch(g, () => {
                    onSelectTier2(g.id);
                    onSelectTier3(null);
                  })
                }
                onDoubleClick={() => onDoubleTapGoal(g)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs transition-all shrink-0 border ${
                  isSelected
                    ? "bg-primary/15 border-primary text-primary font-bold shadow-xs"
                    : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{g.icon || "📂"}</span>
                <span>{g.title}</span>
                {count > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                )}
              </button>
            );
          })}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddNewGoal(selectedTier1Id)}
            className="h-6 px-2 rounded-xl text-[11px] text-muted-foreground hover:text-foreground shrink-0 gap-1"
          >
            <Plus className="w-3 h-3" /> زیرمجموعه
          </Button>
        </div>
      )}

      {/* TIER 3: Deep Sub-goals if present */}
      {selectedTier2Id && tier3Goals.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 ps-4 border-t border-dashed border-border/30 animate-fade-in">
          {tier3Goals.map((g) => {
            const isSelected = selectedTier3Id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleTabTouch(g, () => onSelectTier3(g.id))}
                onDoubleClick={() => onDoubleTapGoal(g)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] transition-all shrink-0 border ${
                  isSelected
                    ? "bg-accent border-accent-foreground text-foreground font-bold"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{g.icon || "▫️"}</span>
                <span>{g.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
