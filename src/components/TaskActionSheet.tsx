import { useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Task } from "@/lib/taskTypes";
import ShareDialog from "@/components/ShareDialog";
import { TaskActivities } from "@/components/TaskActivities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShareAccess } from "@/hooks/useShareAccess";
import { logTaskActivity } from "@/lib/taskActivity";
import { saveTaskTemplate } from "@/lib/taskTemplates";
import {
  Check, Trash2, FolderInput, Network, Pencil, Copy, Share2,
  Sparkles, CopyPlus, Pin, PinOff, Timer, ListTree, Paperclip,
  Tag as TagIcon, MoreHorizontal, MessageSquare, MapPin, X,
  ArrowRight, Loader2, Save, StickyNote, LayoutList, History,
} from "lucide-react";

type View = "main" | "more" | "activities" | "subtask" | "comment" | "location";

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
  onPatch?: (patch: Partial<Task>) => Promise<void> | void;
  onRefresh?: () => void;
}

export default function TaskActionSheet({
  task, onOpenChange, onComplete, onDelete, onMove, onMakeChild, onEdit, onPin, onPomodoro, onPatch, onRefresh,
}: Props) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [shareOpen, setShareOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [comment, setComment] = useState("");
  const [location, setLocation] = useState(task?.location || "");
  const [busy, setBusy] = useState(false);
  const { canEdit, canComment, isOwner } = useShareAccess("task", task?.id, task?.user_id);

  if (!task) return null;

  const close = () => {
    setView("main");
    onOpenChange(false);
  };

  const backToMain = () => setView("main");

  const applyPatch = async (patch: Partial<Task>, activityAction?: string, activityPayload?: Record<string, unknown>) => {
    if (!canEdit) { toast(T("دسترسی ویرایش ندارید", "No edit permission")); return; }
    if (onPatch) {
      await onPatch(patch);
    } else {
      const { error } = await supabase.from("tasks").update(patch as never).eq("id", task.id);
      if (error) { toast.error(error.message); return; }
    }
    if (activityAction && user) {
      await logTaskActivity(task.id, user.id, activityAction, activityPayload || patch);
    }
    onRefresh?.();
  };

  const Tile = ({ icon: Icon, label, onClick, color, disabled }: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
    color?: "yellow" | "green" | "blue" | "red" | "muted";
    disabled?: boolean;
  }) => {
    const colorClass =
      color === "yellow" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15" :
      color === "green" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15" :
      color === "blue" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/15" :
      color === "red" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15" :
      "bg-muted/60 hover:bg-muted text-foreground";
    return (
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition active:scale-95 ${
          disabled ? "opacity-40 cursor-not-allowed bg-muted/40 text-muted-foreground" : colorClass
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-[10px] leading-tight text-center">{label}</span>
      </button>
    );
  };

  const Row = ({ icon: Icon, label, onClick, disabled, value }: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    value?: string;
  }) => (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition active:scale-[0.99] ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-start text-sm">{label}</span>
      {value && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{value}</span>}
    </button>
  );

  const setWontDo = async () => {
    if (!canEdit) return;
    const next = task.status === "wont_do" ? "todo" : "wont_do";
    await applyPatch({ status: next, completed: false }, next === "wont_do" ? "wont_do" : "reopened", { status: next });
    toast.success(next === "wont_do" ? T("علامت‌گذاری شد: انجام نمی‌شود", "Marked won't do") : T("بازگشایی شد", "Reopened"));
    close();
  };

  const handlePin = async () => {
    if (onPin) onPin();
    else await applyPatch({ pinned: !task.pinned }, "pinned", { pinned: !task.pinned });
    close();
  };

  const addSubtask = async () => {
    if (!user || !subtaskTitle.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("subtasks").insert({
        user_id: user.id,
        task_id: task.id,
        title: subtaskTitle.trim(),
      });
      if (error) throw error;
      await logTaskActivity(task.id, user.id, "updated", { subtask_added: subtaskTitle.trim() });
      setSubtaskTitle("");
      onRefresh?.();
      onEdit();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const convertToNote = async () => {
    if (!user || !canEdit) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("notes").insert({
        user_id: user.id,
        task_id: task.id,
        title: task.title,
        content: task.description || "",
      }).select().single();
      if (error) throw error;
      await logTaskActivity(task.id, user.id, "note_created", { note_id: (data as { id: string } | null)?.id });
      toast.success(T("نوت ساخته شد", "Note created"));
      navigate("/app/notes");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (andOpen = false) => {
    if (!user || !canEdit) return;
    const { id: _id, user_id: _uid, ...rest } = task;
    const insert: Partial<Task> = {
      ...rest,
      user_id: user.id,
      title: `${task.title} (copy)`,
      completed: false,
      status: "todo",
    };
    setBusy(true);
    try {
      const { data, error } = await supabase.from("tasks").insert(insert as never).select().single();
      if (error) throw error;
      const newId = (data as { id: string } | null)?.id;
      await logTaskActivity(task.id, user.id, "duplicated", { new_task_id: newId });
      onRefresh?.();
      toast.success(T("کپی شد", "Duplicated"));
      if (andOpen && newId) {
        navigate(`/app/tasks/${newId}`);
      }
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!user || !canEdit) return;
    try {
      await saveTaskTemplate(user.id, task);
      toast.success(T("ذخیره شد در تمپلیت‌ها", "Saved to templates"));
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    }
  };

  const saveComment = async () => {
    if (!canEdit || !comment.trim()) return;
    const updated = task.description ? `${task.description}\n\n${comment.trim()}` : comment.trim();
    await applyPatch({ description: updated }, "updated", { comment_added: true });
    toast.success(T("توضیحات ثبت شد", "Comment saved"));
    close();
  };

  const saveLocation = async () => {
    if (!canEdit) return;
    await applyPatch({ location: location.trim() || null }, "location_set", { location: location.trim() || null });
    toast.success(T("موقعیت ثبت شد", "Location saved"));
    close();
  };

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/app/tasks/${task.id}`;
      await navigator.clipboard.writeText(url);
      toast.success(T("لینک کپی شد", "Link copied"));
    } catch {
      toast.error(T("کپی نشد", "Could not copy"));
    }
    close();
  };

  const mainView = (
    <div className="space-y-4 animate-fade-in">
      <div className="text-start text-sm font-medium truncate px-1">{task.title}</div>

      {/* Top icon row: Pin, Share, Won't Do, Delete */}
      <div className="grid grid-cols-4 gap-2">
        <Tile
          icon={task.pinned ? PinOff : Pin}
          label={task.pinned ? T("حذف پین", "Unpin") : T("پین", "Pin")}
          onClick={handlePin}
          color="yellow"
          disabled={!canEdit}
        />
        <Tile icon={Share2} label={T("اشتراک", "Share")} onClick={() => setShareOpen(true)} color="green" disabled={!isOwner} />
        <Tile
          icon={task.status === "wont_do" ? Check : X}
          label={task.status === "wont_do" ? T("بازگشایی", "Reopen") : T("انجام نمی‌شود", "Won't Do")}
          onClick={setWontDo}
          color="blue"
          disabled={!canEdit}
        />
        <Tile icon={Trash2} label={T("حذف", "Delete")} onClick={() => { onDelete(); close(); }} color="red" disabled={!isOwner} />
      </div>

      {/* Action list */}
      <div className="space-y-0.5">
        <Row icon={Check} label={task.completed ? T("بازگشایی تکمیل", "Reopen") : T("تکمیل", "Done")} onClick={() => { onComplete(); close(); }} disabled={!canComment} />
        <Row icon={Pencil} label={T("ویرایش / باز کردن", "Edit / Open")} onClick={() => { onEdit(); close(); }} />
        <Row icon={Sparkles} label="AI" onClick={() => { navigate(`/app/tasks/${task.id}?ai=1`); close(); }} disabled={!canEdit} />
        <Row icon={Timer} label={T("پومودورو", "Pomodoro")} onClick={() => { onPomodoro?.(); close(); }} />
        <Row icon={FolderInput} label={T("انتقال", "Move")} onClick={() => { onMove(); close(); }} disabled={!canEdit} />
        <Row icon={ListTree} label={T("افزودن زیرتسک", "Add Subtask")} onClick={() => setView("subtask")} disabled={!canEdit} />
        <Row icon={Network} label={T("لینک به تسک والد", "Link Parent Task")} onClick={() => { onMakeChild(); close(); }} disabled={!canEdit} />
        <Row icon={StickyNote} label={T("تبدیل به نوت", "Convert to Note")} onClick={convertToNote} disabled={!canEdit || busy} />
        <Row icon={Paperclip} label={T("ضمیمه", "Attachment")} onClick={() => { onEdit(); close(); }} disabled={!canEdit} />
        <Row icon={TagIcon} label={T("تگ", "Tags")} onClick={() => { onEdit(); close(); }} disabled={!isOwner} />
        <Row icon={History} label={T("فعالیت‌ها", "Activities")} onClick={() => setView("activities")} />
        <Row icon={MoreHorizontal} label={T("بیشتر", "More")} onClick={() => setView("more")} />
      </div>
    </div>
  );

  const header = (title: string, onBack: () => void) => (
    <div className="flex items-center gap-2 mb-4">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
        <ArrowRight className="w-4 h-4" />
      </Button>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );

  const renderView = () => {
    switch (view) {
      case "subtask":
        return (
          <div className="animate-fade-in space-y-3">
            {header(T("افزودن زیرتسک", "Add Subtask"), backToMain)}
            <Input
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder={T("عنوان زیرتسک...", "Subtask title...")}
              dir="auto"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
            />
            <Button onClick={addSubtask} disabled={!subtaskTitle.trim() || busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {T("ذخیره", "Save")}
            </Button>
          </div>
        );
      case "activities":
        return (
          <div className="animate-fade-in">
            {header(T("فعالیت‌های تسک", "Task Activities"), backToMain)}
            <TaskActivities taskId={task.id} />
          </div>
        );
      case "more":
        return (
          <div className="animate-fade-in space-y-0.5">
            {header(T("بیشتر", "More"), backToMain)}
            <Row icon={MessageSquare} label={T("افزودن توضیح", "Add Comment")} onClick={() => setView("comment")} disabled={!canEdit} />
            <Row icon={MapPin} label={T("موقعیت", "Location")} onClick={() => setView("location")} value={task.location || undefined} disabled={!canEdit} />
            <Row icon={Copy} label={T("کپی لینک", "Copy Link")} onClick={copyLink} />
            <Row icon={CopyPlus} label={T("تکثیر", "Duplicate")} onClick={() => duplicate(false)} disabled={!canEdit || busy} />
            <Row icon={Save} label={T("ذخیره و جدید", "Save & New")} onClick={() => duplicate(true)} disabled={!canEdit || busy} />
            <Row icon={LayoutList} label={T("ذخیره به‌عنوان تمپلیت", "Save as Template")} onClick={saveTemplate} disabled={!canEdit} />
            <Row icon={Pencil} label={T("ویرایش کامل", "Full Edit")} onClick={() => { onEdit(); close(); }} />
          </div>
        );
      case "comment":
        return (
          <div className="animate-fade-in space-y-3">
            {header(T("توضیح / کامنت", "Comment"), () => setView("more"))}
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={T("توضیحی بنویس...", "Write a comment...")}
              dir="auto"
              rows={4}
            />
            <Button onClick={saveComment} disabled={!comment.trim()} className="w-full">
              {T("ذخیره توضیح", "Save Comment")}
            </Button>
          </div>
        );
      case "location":
        return (
          <div className="animate-fade-in space-y-3">
            {header(T("موقعیت", "Location"), () => setView("more"))}
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={T("مثلاً: دفتر، خانه...", "e.g. Office, Home...")}
              dir="auto"
            />
            <Button onClick={saveLocation} className="w-full">
              {T("ذخیره موقعیت", "Save Location")}
            </Button>
          </div>
        );
      default:
        return mainView;
    }
  };

  return (
    <>
      <Sheet open={!!task && !shareOpen} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-5 px-3 pt-4 max-h-[85vh] overflow-y-auto">
          {renderView()}
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
