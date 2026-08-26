import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Target, Calendar, Flag, Sparkles, FolderTree } from "lucide-react";
import {
  type GoalKanban,
  type TimeHorizon,
  type GoalPriority,
  TIME_HORIZONS,
  GOAL_PRIORITIES,
} from "@/lib/kanbanGoals";

interface GoalEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalKanban | null;
  allGoals: GoalKanban[];
  defaultParentId?: string | null;
  onSave: (goalData: Partial<GoalKanban>) => void;
  onDelete?: (goalId: string) => void;
}

export default function GoalEditorModal({
  open,
  onOpenChange,
  goal,
  allGoals,
  defaultParentId = null,
  onSave,
  onDelete,
}: GoalEditorModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("monthly");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("🎯");

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || "");
      setDescription(goal.description || "");
      setParentId(goal.parentId || null);
      setTimeHorizon(goal.timeHorizon || "monthly");
      setPriority(goal.priority || "medium");
      setColor(goal.color || "#3b82f6");
      setIcon(goal.icon || "🎯");
    } else {
      setTitle("");
      setDescription("");
      setParentId(defaultParentId);
      setTimeHorizon("monthly");
      setPriority("medium");
      setColor("#3b82f6");
      setIcon("🎯");
    }
  }, [goal, defaultParentId, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...(goal ? { id: goal.id } : {}),
      title: title.trim(),
      description: description.trim() || undefined,
      parentId: parentId === "none" ? null : parentId,
      timeHorizon,
      priority,
      color,
      icon,
    });
    onOpenChange(false);
  };

  const eligibleParents = allGoals.filter((g) => g.id !== goal?.id);

  const EMOJI_OPTIONS = ["🎯", "📚", "🗣️", "🤖", "💼", "🫀", "🚀", "🌟", "💡", "🎨", "🏃‍♂️", "🌿", "🧘‍♀️", "🔥"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Target className="w-5 h-5 text-primary" />
            {goal ? "ویرایش کانبان / هدف" : "ایجاد هدف و کانبان جدید"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            هر کانبان یک هدف با افق زمانی، اولویت و ساختار والد-فرزندی است.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title & Icon */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">عنوان هدف</Label>
            <div className="flex gap-2">
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="w-16 text-lg shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <div className="grid grid-cols-4 gap-1 p-1 text-lg">
                    {EMOJI_OPTIONS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setIcon(em)}
                        className={`p-2 text-center rounded-md hover:bg-muted ${
                          icon === em ? "bg-primary/20" : ""
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </SelectContent>
              </Select>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: آموزش و خودآگاهی، مکالمه زبان..."
                className="flex-1"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">توضیحات و یادداشت</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح اهداف، برنامه اجرایی یا یادداشت‌های مهم این کانبان..."
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          {/* Parent Goal Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-muted-foreground" />
              هدف والد (زیرمجموعه کدام کانبان باشد؟)
            </Label>
            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? null : v)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="یک هدف اصلی (بدون والد)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs font-bold text-primary">
                  ⭐ هدف اصلی (سطح ۱ - ریشه)
                </SelectItem>
                {eligibleParents.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.icon || "🎯"} {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Horizon & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Time Horizon */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-muted-foreground" /> افق زمانی
              </Label>
              <Select value={timeHorizon} onValueChange={(v) => setTimeHorizon(v as TimeHorizon)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_HORIZONS.map((th) => (
                    <SelectItem key={th.id} value={th.id} className="text-xs">
                      {th.icon} {th.labelFa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Flag className="w-3 h-3 text-muted-foreground" /> سطح اهمیت
              </Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as GoalPriority)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_PRIORITIES.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id} className="text-xs">
                      {pr.badge} {pr.labelFa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
          {goal && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onDelete(goal.id);
                onOpenChange(false);
              }}
              className="text-xs text-destructive hover:bg-destructive/10 gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> حذف کانبان
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              انصراف
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={!title.trim()} className="text-xs font-bold">
              {goal ? "ذخیره تغییرات" : "ایجاد کانبان"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
