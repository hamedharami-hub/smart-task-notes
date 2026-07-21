import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Check, Trash2, FolderInput, Network, Pencil, Copy, Share2,
  Sparkles, CopyPlus, Calendar as CalendarIcon, Flag, Pin, PinOff, Timer,
} from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/lib/taskTypes";
import ShareDialog from "@/components/ShareDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DueDatePicker } from "@/components/DueDatePicker";
import { PRIORITY_SELECTABLE, PRIORITY_META, type Priority } from "@/lib/priority";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShareAccess } from "@/hooks/useShareAccess";

interface Props {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onDelete: () => void;
  onMove: () => void;
  onMakeChild: () => void;
  onEdit: () => void;
  onPin?: () => void;
  onPomodoro?: () => void;
  onPatch?: (patch: Partial<Task>) => void;
}

export default function TaskActionSheet({
  task, onOpenChange, onComplete, onDelete, onMove, onMakeChild, onEdit, onPin, onPomodoro, onPatch,
}: Props) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [shareOpen, setShareOpen] = useState(false);
  const { canEdit, canComment, isOwner } = useShareAccess("task", task?.id, task?.user_id);

  if (!task) return null;

  const close = () => onOpenChange(false);

  const Tile = ({ icon: Icon, label, onClick, danger, accent, disabled }: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
    danger?: boolean;
    accent?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition active:scale-95 ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-muted/40 text-muted-foreground"
          : danger
            ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
            : accent
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "bg-muted/60 hover:bg-muted text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] leading-tight text-center">{label}</span>
    </button>
  );

  const setPriority = async (p: Priority) => {
    if (!canEdit) { toast(T("دسترسی ویرایش ندارید", "No edit permission")); return; }
    onPatch?.({ priority: p });
    if (!onPatch) await supabase.from("tasks").update({ priority: p }).eq("id", task.id);
    close();
  };

  const setDate = async (iso: string | null) => {
    if (!canEdit) { toast(T("دسترسی ویرایش ندارید", "No edit permission")); return; }
    onPatch?.({ due_date: iso });
    if (!onPatch) await supabase.from("tasks").update({ due_date: iso }).eq("id", task.id);
  };

  const duplicate = async () => {
    if (!user) return;
    if (!canEdit) { toast(T("دسترسی ویرایش ندارید", "No edit permission")); return; }
    const { id, created_at, updated_at, ...rest } = task as any;
    const { error } = await supabase.from("tasks").insert({
      ...rest, user_id: user.id, title: `${task.title} (copy)`,
    });
    if (error) toast.error(error.message);
    else toast.success(T("کپی شد", "Duplicated"));
    close();
  };

  return (
    <>
      <Sheet open={!!task && !shareOpen} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-5 px-3 pt-4 max-h-[80vh] overflow-y-auto">
          {/* Title */}
          <div className="text-start text-sm font-medium truncate mb-3 px-1">{task.title}</div>

          {/* Priority quick row */}
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <Flag className="w-3 h-3 text-muted-foreground shrink-0" />
            {PRIORITY_SELECTABLE.map((p) => {
              const m = PRIORITY_META[p as Priority];
              const active = task.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p as Priority)}
                  disabled={!canEdit}
                  className={`flex-1 text-[10px] px-1.5 py-1 rounded-md border transition ${
                    active ? `${m.bgClass} ${m.textClass} border-current` : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  } ${!canEdit ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {m.label}
                </button>
              );
            })}
            {task.priority !== "none" && (
              <button
                onClick={() => setPriority("none" as Priority)}
                disabled={!canEdit}
                className={`text-[10px] px-1.5 py-1 rounded-md text-muted-foreground ${canEdit ? "hover:bg-muted" : "opacity-40 cursor-not-allowed"}`}
                title={T("حذف", "Clear")}
              >
                ×
              </button>
            )}
          </div>

          {/* Actions grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <Tile
              icon={Check}
              label={task.completed ? T("بازگشایی", "Reopen") : T("تکمیل", "Done")}
              onClick={() => { onComplete(); close(); }}
              disabled={!canComment}
              accent
            />
            <Tile icon={Pencil} label={T("باز کردن", "Open")} onClick={() => { onEdit(); close(); }} />
            <Tile
              icon={Sparkles}
              label="AI"
              disabled={!canEdit}
              onClick={() => { close(); navigate(`/app/tasks/${task.id}?ai=1`); }}
              accent
            />
            <Tile icon={Share2} label={T("اشتراک", "Share")} disabled={!isOwner} onClick={() => setShareOpen(true)} />

            <Popover>
              <PopoverTrigger asChild>
                <button disabled={!canEdit} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition ${canEdit ? "bg-muted/60 hover:bg-muted active:scale-95" : "opacity-40 cursor-not-allowed bg-muted/40 text-muted-foreground"}`}>
                  <CalendarIcon className="w-4 h-4" />
                  <span className="text-[10px]">{T("تاریخ", "Date")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="start">
                <DueDatePicker
                  value={task.due_date}
                  onChange={(iso) => setDate(iso)}
                  reminderValue={task.reminder_at}
                  onReminderChange={(iso) => onPatch?.({ reminder_at: iso })}
                  label=""
                />
              </PopoverContent>
            </Popover>

            <Tile
              icon={task.pinned ? PinOff : Pin}
              label={task.pinned ? T("حذف پین", "Unpin") : T("پین", "Pin")}
              onClick={() => { onPin?.(); close(); }}
              disabled={!canEdit}
              accent={task.pinned}
            />
            <Tile icon={FolderInput} label={T("انتقال", "Move")} disabled={!canEdit} onClick={() => { onMove(); close(); }} />
            <Tile icon={Network} label={T("زیرتسک", "Subtask")} disabled={!canEdit} onClick={() => { onMakeChild(); close(); }} />
            <Tile icon={CopyPlus} label={T("تکثیر", "Duplicate")} disabled={!canEdit} onClick={duplicate} />
            <Tile
              icon={Timer}
              label={T("پومودورو", "Pomodoro")}
              disabled={!isOwner}
              onClick={() => { onPomodoro?.(); close(); }}
              accent
            />

            <Tile
              icon={Copy}
              label={T("کپی عنوان", "Copy")}
              onClick={async () => {
                try { await navigator.clipboard.writeText(task.title); toast.success(T("کپی شد", "Copied")); } catch { /* noop */ }
                close();
              }}
            />
            <Tile icon={Trash2} label={T("حذف", "Delete")} disabled={!isOwner} onClick={() => { onDelete(); close(); }} danger />
          </div>
        </SheetContent>
      </Sheet>

      <ShareDialog
        open={shareOpen}
        onOpenChange={(v) => { setShareOpen(v); if (!v) onOpenChange(false); }}
        resourceType="task"
        resourceId={task.id}
        resourceTitle={task.title}
      />
    </>
  );
}
