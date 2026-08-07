import { useEffect, useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShareAccess } from "@/hooks/useShareAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { BidiText } from "@/components/BidiText";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Sparkles, Trash2, FileText, Clock, ArrowRight, Ban,
  Folder as FolderIcon, Tag as TagIcon, Check, Calendar as CalendarIcon,
  Flag, Repeat, ListTree, Paperclip, X, Image as ImageIcon, Music, Link as LinkIcon,
  CheckSquare, ListChecks, CalendarDays, Mic, MicOff, Pin, PinOff, Maximize2, Minimize2,
  GitBranch,
} from "lucide-react";
import { VoiceInput } from "@/lib/voiceInput";
import { PRIORITY_META, PRIORITY_ORDER, type Priority } from "@/lib/priority";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

import { RecurrenceEditor } from "@/components/RecurrenceEditor";
import { TaskAIPanel } from "@/components/TaskAIPanel";
import { NoteEditorTabs } from "@/components/NoteEditorTabs";
import { TaskStepLists } from "@/components/TaskStepLists";
import { TaskSubtasksInline } from "@/components/TaskSubtasksInline";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskDescriptionEditor } from "@/components/TaskDescriptionEditor";
import { TaskOutcomeSheet } from "@/components/TaskOutcomeSheet";
import { TaskOutcomesInline } from "@/components/TaskOutcomesInline";
import { DueDatePicker } from "@/components/DueDatePicker";
import { BucketPickerBody } from "@/components/BucketPickerInline";
import { bucketLabel, kindLabel } from "@/lib/timeBuckets";
import { describeRule } from "@/lib/recurrence";
import { addDays, endOfDay } from "date-fns";

import { Switch } from "@/components/ui/switch";
import { pushUndo } from "@/lib/undoStack";
import { enqueueOp, cacheGet, cacheSet } from "@/lib/offlineQueue";
import type { Task, TaskNote, ConfirmState } from "@/lib/taskTypes";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export function TaskDetail({ task, onClose, onChanged, setConfirm, mode = "sheet", allowDelete = false }: {
  task: Task;
  onClose: () => void;
  onChanged: () => void;
  setConfirm: (c: ConfirmState) => void;
  mode?: "sheet" | "page" | "drawer";
  allowDelete?: boolean;
}) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const { canEdit, canComment, isOwner } = useShareAccess("task", task.id, task.user_id);
  const isMobile = useIsMobile();

  const [t, setT] = useState(task);
  const [taskNotes, setTaskNotes] = useState<TaskNote[]>([]);
  const [activeNote, setActiveNote] = useState<TaskNote | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [snap, setSnap] = useState<number | string>(0.5);
  const [folders, setFolders] = useState<{ id: string; name: string; parent_id: string | null; color: string | null }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);

  // Section reveal flags – start open so subtasks, checklists and branches are visible by default
  const hasTimeBlock = !!(t.start_at || t.end_at || t.estimated_minutes);
  const isScheduled = !!t.due_date || !!t.reminder_at || !!t.recurrence_rule || !!t.bucket_kind || hasTimeBlock;
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showTimeBlock, setShowTimeBlock] = useState(hasTimeBlock);
  const [showOutcomes, setShowOutcomes] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInstance, setVoiceInstance] = useState<VoiceInput | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [parentTitle, setParentTitle] = useState("");
  const [allTasks, setAllTasks] = useState<{ id: string; title: string; parent_id: string | null }[]>([]);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeCount, setOutcomeCount] = useState(0);
  const [outcomeRefresh, setOutcomeRefresh] = useState(0);


  useEffect(() => { setT(task); }, [task.id]);

  // Initialize voice input
  useEffect(() => {
    const voice = new VoiceInput({
      onTranscript: (text) => {
        setT(prev => ({ ...prev, title: prev.title ? prev.title.trimEnd() + " " + text : text }));
      },
      onError: (error) => {
        toast.error(error);
      },
      onListeningChange: (isListening) => {
        setVoiceListening(isListening);
      },
    });
    setVoiceInstance(voice);
    return () => {
      voice.stop();
    };
  }, []);

  // Auto-reveal sections that already have data so user doesn't need to tap rail icons
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [notesRes, tagsRes, subRes, stepListsRes, attachRes, outcomesRes] = await Promise.all([
        supabase.from("notes").select("id,title,content").eq("task_id", task.id).order("updated_at", { ascending: false }),
        supabase.from("task_tags").select("tag_id").eq("task_id", task.id),
        supabase.from("subtasks").select("id", { count: "exact", head: true }).eq("task_id", task.id),
        supabase.from("task_step_lists").select("id", { count: "exact", head: true }).eq("task_id", task.id),
        supabase.from("task_attachments").select("id", { count: "exact", head: true }).eq("task_id", task.id),
        supabase.from("task_outcomes").select("id", { count: "exact", head: true }).eq("task_id", task.id),
      ]);
      if (cancelled) return;
      const list = (notesRes.data || []) as any;
      setTaskNotes(list);
      if (list.length > 0) setShowNotes(true);
      setTaskTagIds((tagsRes.data || []).map((r: any) => r.tag_id));
      if ((subRes.count || 0) > 0) setShowSubtasks(true);
      if ((stepListsRes.count || 0) > 0) setShowSteps(true);
      if ((attachRes.count || 0) > 0) setShowAttachments(true);
      if (hasTimeBlock) setShowTimeBlock(true);
      if ((outcomesRes.count || 0) > 0) setShowOutcomes(true);
      setOutcomeCount(outcomesRes.count || 0);
    })();
    return () => { cancelled = true; };
  }, [task.id]);

  useEffect(() => {
    if (!user) return;
    const loadCached = async () => {
      const [cf, ct, ca] = await Promise.all([
        cacheGet<any[]>(`folders:${user.id}`),
        cacheGet<any[]>(`tags:${user.id}`),
        cacheGet<{ id: string; title: string; parent_id: string | null }[]>(`tasks:all:${user.id}`),
      ]);
      if (cf) setFolders(cf);
      if (ct) setTags(ct);
      if (ca) setAllTasks(ca.map(t => ({ id: t.id, title: t.title, parent_id: t.parent_id ?? null })));
    };
    loadCached();

    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    supabase.from("folders").select("id,name,parent_id,color").order("position").then(({ data }) => {
      setFolders((data || []) as any);
    });
    supabase.from("tags").select("id,name,color").order("name").then(({ data }) => {
      setTags((data || []) as any);
    });
    supabase.from("tasks").select("id,title,parent_id").order("title").then(({ data }) => {
      setAllTasks((data || []) as unknown as typeof allTasks);
    });
  }, [user]);

  useEffect(() => {
    if (!t.parent_id) { setParentTitle(""); return; }
    supabase.from("tasks").select("title").eq("id", t.parent_id).maybeSingle().then(({ data }) => {
      setParentTitle((data?.title as string) || "—");
    });
  }, [t.parent_id]);

  const parentCandidates = useMemo(() => {
    const id = t.id;
    const byId: Record<string, typeof allTasks[number]> = {};
    allTasks.forEach((x) => { byId[x.id] = x; });
    const descendants = new Set<string>();
    const collect = (root: string) => {
      allTasks.filter((x) => x.parent_id === root).forEach((x) => { descendants.add(x.id); collect(x.id); });
    };
    collect(id);
    return allTasks.filter((x) => x.id !== id && !descendants.has(x.id));
  }, [allTasks, t.id]);

  const folderName = (id: string | null): string => {
    if (!id) return T("بدون فولدر", "No folder");
    const f = folders.find(x => x.id === id);
    if (!f) return "—";
    const parent = f.parent_id ? folders.find(x => x.id === f.parent_id) : null;
    return parent ? `${parent.name} / ${f.name}` : f.name;
  };

  const generateId = () => {
    try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  };

  const toggleTag = async (tagId: string) => {
    if (!user || !canEdit) return;
    if (taskTagIds.includes(tagId)) {
      const next = taskTagIds.filter(x => x !== tagId);
      setTaskTagIds(next);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOp({ table: "task_tags", op: "delete", match: { task_id: t.id, tag_id: tagId } });
        return;
      }
      try { await supabase.from("task_tags").delete().eq("task_id", t.id).eq("tag_id", tagId); } catch { void 0; }
    } else {
      setTaskTagIds([...taskTagIds, tagId]);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOp({ table: "task_tags", op: "insert", payload: { task_id: t.id, tag_id: tagId, user_id: user.id } });
        return;
      }
      try { await supabase.from("task_tags").insert({ task_id: t.id, tag_id: tagId, user_id: user.id }); } catch { void 0; }
    }
  };

  const refreshTask = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const { data } = await supabase.from("tasks").select("*").eq("id", task.id).single();
      if (data) setT(data as any);
      onChanged();
    } catch {
      // ignore network errors while offline
    }
  };

  const refreshOutcomeCount = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const { count } = await supabase.from("task_outcomes").select("id", { count: "exact", head: true }).eq("task_id", task.id);
      setOutcomeCount(count || 0);
      if ((count || 0) > 0) setShowOutcomes(true);
      setOutcomeRefresh(n => n + 1);
    } catch {
      // ignore network errors while offline
    }
  };

  const save = async (patch: Partial<Task>) => {
    if (!canEdit) return;
    const next = { ...t, ...patch };
    setT(next);
    onChanged();

    if (user) {
      const cached = await cacheGet<Task[]>(`tasks:all:${user.id}`);
      if (cached) {
        await cacheSet(`tasks:all:${user.id}`, cached.map(x => x.id === t.id ? { ...x, ...patch } : x));
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueueOp({ table: "tasks", op: "update", payload: patch, match: { id: t.id } });
      return;
    }
    try {
      await supabase.from("tasks").update(patch as any).eq("id", t.id);
    } catch (e) {
      // If the network call fails, queue the update so the edit isn't lost
      await enqueueOp({ table: "tasks", op: "update", payload: patch, match: { id: t.id } });
    }
  };

  const deleteTask = () => {
    setConfirm({
      kind: "task",
      id: t.id,
      title: t.title || T("بدون عنوان", "Untitled"),
      onConfirm: async () => {
        if (user) {
          const cached = await cacheGet<Task[]>(`tasks:all:${user.id}`);
          if (cached) await cacheSet(`tasks:all:${user.id}`, cached.filter(x => x.id !== t.id));
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueueOp({ table: "tasks", op: "delete", match: { id: t.id } });
          onClose();
          onChanged();
          return;
        }
        try {
          await supabase.from("tasks").delete().eq("id", t.id);
        } catch {
          await enqueueOp({ table: "tasks", op: "delete", match: { id: t.id } });
        }
        onClose();
        onChanged();
      },
    });
  };

  const postpone = (days: number) => {
    const base = t.due_date ? new Date(t.due_date) : endOfDay(new Date());
    const next = addDays(base, days);
    save({ due_date: next.toISOString() });
    setScheduleOpen(false);
    toast(T(`تسک به ${days} روز دیگر موکول شد`, `Task postponed by ${days} day(s)`));
  };

  const addNote = async () => {
    if (!user || !canEdit) return;
    const { data, error } = await supabase.from("notes").insert({
      user_id: user.id, task_id: t.id, title: T("نوت جدید", "New note"), content: "",
    }).select().single();
    if (error) return toast.error(error.message);
    if (data) {
      setTaskNotes([data as any, ...taskNotes]);
      setActiveNote(data as any);
      setShowNotes(true);
    }
  };

  const saveNote = async (id: string, patch: Partial<TaskNote>) => {
    if (!canEdit) return;
    setTaskNotes(taskNotes.map(n => n.id === id ? { ...n, ...patch } : n));
    if (activeNote?.id === id) setActiveNote({ ...activeNote, ...patch });
    await supabase.from("notes").update(patch).eq("id", id);
  };

  const askDelNote = (n: TaskNote) => {
    setConfirm({
      kind: "note", id: n.id, title: n.title || T("بدون عنوان", "Untitled"),
      onConfirm: async () => {
        const { data: snap } = await supabase.from("notes").select("*").eq("id", n.id).maybeSingle();
        await supabase.from("notes").delete().eq("id", n.id);
        setTaskNotes(prev => prev.filter(x => x.id !== n.id));
        if (activeNote?.id === n.id) setActiveNote(null);
        if (snap) {
          pushUndo({
            label: T(`نوت «${snap.title || "بدون عنوان"}» حذف شد`, `Note "${snap.title || "Untitled"}" deleted`),
            undo: async () => {
              await supabase.from("notes").insert(snap as any);
              const { data } = await supabase.from("notes").select("id,title,content").eq("task_id", task.id)
                .order("updated_at", { ascending: false });
              setTaskNotes((data || []) as any);
            },
          });
        }
      },
    });
  };

  // ── Quick chip helpers ──────────────────────────────────────────────
  const formatDue = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(isEn ? "en-US" : "fa-IR", { month: "short", day: "numeric" });
  };

  const priorityMeta = PRIORITY_META[t.priority];
  const dueLabel = formatDue(t.due_date);
  const recLabel = t.recurrence_rule ? describeRule(t.recurrence_rule, isEn) : null;
  const scheduleLabel = (() => {
    if (t.due_date) {
      const dateStr = formatDue(t.due_date);
      if (t.reminder_at) {
        const timeStr = new Date(t.reminder_at).toLocaleTimeString(isEn ? "en-US" : "fa-IR", { hour: "2-digit", minute: "2-digit" });
        return `${dateStr} · ${timeStr}`;
      }
      return dateStr;
    }
    if (t.reminder_at) {
      return new Date(t.reminder_at).toLocaleTimeString(isEn ? "en-US" : "fa-IR", { hour: "2-digit", minute: "2-digit" });
    }
    if (t.bucket_kind && t.bucket_anchor) {
      return bucketLabel(t.bucket_kind, (t.bucket_calendar as any) || "gregorian", t.bucket_anchor, isEn ? "en" : "fa");
    }
    if (t.recurrence_rule) return recLabel;
    if (t.start_at || t.end_at) return T("تایم‌بلاک", "Time block");
    return null;
  })();

  // ── Rail icon button (MD3 tonal) ────────────────────────────────────
  const RailButton = ({
    icon: Icon, label, active, badge, onClick, accent, className, disabled,
  }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex flex-col items-center justify-center gap-0 min-w-[52px] h-11 rounded-xl transition active:scale-95 disabled:opacity-50 disabled:cursor-default ${
        active
          ? accent
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted/60"
      } ${className || ""}`}
    >
      <Icon className="w-4 h-4" />
      {badge != null && badge !== 0 && (
        <span className="absolute top-0.5 end-0.5 min-w-[13px] h-[13px] px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-medium flex items-center justify-center">
          {badge}
        </span>
      )}
      <span className="text-[9px] mt-0.5 leading-none line-clamp-1 px-1 text-center">{label}</span>
    </button>
  );

  const Chip = ({ icon: Icon, children, onClick, onClear, color, disabled }: any) => (
    <span
      onClick={disabled ? undefined : onClick}
      className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[10px] transition ${
        disabled
          ? "text-muted-foreground/50"
          : color || "bg-muted/60 text-foreground/80 hover:bg-muted cursor-pointer"
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      <span className="truncate max-w-[120px]">{children}</span>
      {onClear && !disabled && (
        <X
          className="w-3 h-3 opacity-60 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
        />
      )}
    </span>
  );

  // ── Hero (title + description) ─────────────────────────────────────
  const hero = (
    <div className="px-1 pb-2">
      <div className="flex items-start gap-1.5">
        <Button
          size="icon"
          variant="ghost"
          disabled={!canEdit}
          onClick={() => save({ pinned: !t.pinned })}
          className={`h-9 w-9 shrink-0 ${t.pinned ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
          title={t.pinned ? T("حذف پین", "Unpin") : T("پین", "Pin")}
        >
          <Pin className={`w-4 h-4 ${t.pinned ? "fill-primary" : ""}`} />
        </Button>
        <AutoTextarea
          value={t.title}
          onChange={(e) => setT({ ...t, title: e.target.value })}
          onBlur={() => save({ title: t.title })}
          readOnly={!canEdit}
          minHeight={44}
          maxHeight={220}
          rows={1}
          dir="auto"
          placeholder={T("عنوان تسک را اینجا بنویس…", "Write the task title here…")}
          className="text-lg md:text-xl font-semibold leading-snug bg-muted/40 border border-dashed border-primary/40 rounded-md px-2 py-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-background break-words whitespace-pre-wrap tracking-tight placeholder:text-primary/60 placeholder:font-medium flex-1 min-h-[40px]"
        />
        <Button
          size="icon"
          variant={voiceListening ? "default" : "ghost"}
          disabled={!canEdit}
          onClick={() => voiceInstance?.toggle(i18n.language === "en" ? "en-US" : "fa-IR")}
          className="h-9 w-9 shrink-0"
          title={T("ضبط صوتی", "Voice input")}
        >
          {voiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      </div>
      <div data-rich-selection onContextMenu={(e) => e.preventDefault()} style={{ WebkitTouchCallout: "none" } as any}>
        <TaskDescriptionEditor
          taskId={t.id}
          value={t.description || ""}
          onChange={(v) => setT({ ...t, description: v })}
          onSave={(v) => save({ description: v })}
          readOnly={!canEdit}
        />
      </div>
      <div className="flex items-center gap-2 mt-1 px-0">
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => { await addNote(); }}
            className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground rounded-full px-2"
          >
            <Plus className="w-3 h-3" />
            <FileText className="w-3.5 h-3.5" />
            {T("افزودن نوت با عنوان", "Add titled note")}
          </Button>
        )}
        {taskNotes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNotes(s => !s)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {taskNotes.length} {T("نوت", "notes")} {showNotes ? "▴" : "▾"}
          </button>
        )}
      </div>
    </div>
  );

  // ── Quick-info chips row (only what's set) ──────────────────────────
  const quickChips = (
    <div className="flex flex-wrap gap-1 px-1 pb-2">
      {dueLabel && (
        <Chip
          icon={CalendarIcon}
          onClick={() => setScheduleOpen(true)}
          onClear={() => save({ due_date: null, reminder_at: null })}
          disabled={!canEdit}
          color="bg-primary/10 text-primary"
        >
          {dueLabel}
        </Chip>
      )}
      {t.bucket_kind && t.bucket_anchor && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Chip
                  icon={CalendarDays}
                  onClear={() => save({ bucket_kind: null, bucket_calendar: null, bucket_anchor: null } as any)}
                  disabled={!canEdit}
                  color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  {kindLabel(t.bucket_kind, isEn ? "en" : "fa")} · {bucketLabel(t.bucket_kind, (t.bucket_calendar as any) || "gregorian", t.bucket_anchor, isEn ? "en" : "fa")}
                </Chip>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {T("این تسک در بازهٔ زمانی قرار دارد", "This task is in a time bucket")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {t.priority !== "none" && (
        <Chip
          icon={Flag}
          onClick={() => save({ priority: "none" as Priority })}
          disabled={!canEdit}
          color={`${priorityMeta.bgClass} ${priorityMeta.textClass}`}
        >
          {T(priorityMeta.label, priorityMeta.labelEn)}
        </Chip>
      )}
      {recLabel && (
        <Chip
          icon={Repeat}
          onClear={() => save({ recurrence_rule: null } as any)}
          disabled={!canEdit}
          color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        >
          {recLabel}
        </Chip>
      )}
      {t.folder_id && (
        <Chip icon={FolderIcon}>{folderName(t.folder_id)}</Chip>
      )}
      {t.parent_id && (
        <Chip
          icon={ListTree}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          onClick={() => navigate(`/app/tasks/${t.parent_id}`)}
          onClear={isOwner ? () => save({ parent_id: null }) : undefined}
          disabled={!canEdit}
        >
          {parentTitle || "—"}
        </Chip>
      )}
      {t.pinned && (
        <Chip icon={Pin} color="bg-primary/10 text-primary">
          {T("پین شده", "Pinned")}
        </Chip>
      )}
      {taskTagIds.length > 0 && (
        <Chip icon={TagIcon}>
          {taskTagIds.length} {T("تگ", "tags")}
        </Chip>
      )}
      {t.is_avoidance && (
        <Chip
          icon={Ban}
          onClear={() => save({ is_avoidance: false } as any)}
          disabled={!canEdit}
          color="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        >
          {T("اجتنابی", "Avoidance")}
        </Chip>
      )}
    </div>
  );

  // ── Quick-create helpers ────────────────────────────────────────────
  const TAG_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<string>(TAG_COLORS[5]);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[3]);
  const [showTagCreate, setShowTagCreate] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const createFolderAndAssign = async () => {
    if (!user || !isOwner || !newFolderName.trim()) return;
    const folderId = generateId();
    const newFolder = { id: folderId, user_id: user.id, name: newFolderName.trim(), color: newFolderColor, parent_id: null };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFolders((f) => [...f, newFolder]);
      setNewFolderName("");
      await enqueueOp({ table: "folders", op: "insert", payload: newFolder });
      await save({ folder_id: folderId });
      toast.success(T("فولدر ساخته شد؛ با اتصال اینترنت همگام می‌شود", "Folder created — will sync when online"));
      return;
    }

    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: user.id, name: newFolderName.trim(), color: newFolderColor })
      .select().single();
    if (error) return toast.error(error.message);
    setFolders((f) => [...f, data as any]);
    setNewFolderName("");
    await save({ folder_id: (data as any).id });
    toast.success(T("فولدر ساخته شد", "Folder created"));
  };

  const createTagAndAssign = async () => {
    if (!user || !canEdit || !newTagName.trim()) return;
    const tagId = generateId();
    const newTag = { id: tagId, user_id: user.id, name: newTagName.trim(), color: newTagColor };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setTags((tg) => [...tg, newTag]);
      setTaskTagIds([...taskTagIds, tagId]);
      await enqueueOp({ table: "tags", op: "insert", payload: newTag });
      await enqueueOp({ table: "task_tags", op: "insert", payload: { task_id: t.id, tag_id: tagId, user_id: user.id } });
      setNewTagName("");
      toast.success(T("تگ ساخته شد؛ با اتصال اینترنت همگام می‌شود", "Tag created — will sync when online"));
      return;
    }

    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name: newTagName.trim(), color: newTagColor })
      .select().single();
    if (error) return toast.error(error.message);
    setTags((tg) => [...tg, data as any]);
    setNewTagName("");
    await supabase.from("task_tags").insert({ task_id: t.id, tag_id: (data as any).id, user_id: user.id });
    setTaskTagIds([...taskTagIds, (data as any).id]);
    toast.success(T("تگ ساخته شد", "Tag created"));
  };

  const attachLink = async () => {
    if (!user || !canEdit || !linkUrl.trim()) return;
    const url = linkUrl.trim();
    const { error } = await supabase.from("task_attachments").insert({
      user_id: user.id,
      task_id: t.id,
      url,
      storage_path: "",
      file_name: url.replace(/^https?:\/\//, "").slice(0, 80),
      mime_type: "text/uri-list",
      kind: "file" as any,
      size_bytes: 0,
    } as any);
    if (error) return toast.error(error.message);
    setLinkUrl("");
    setShowAttachments(true);
    toast.success(T("لینک افزوده شد", "Link added"));
    window.dispatchEvent(new CustomEvent(`lov:attach-refresh:${t.id}`));
  };

  const pickFileType = (accept: string) => {
    setShowAttachments(true);
    // Defer so the section mounts first
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(`lov:attach-pick:${t.id}`, { detail: { accept } }));
    }, 50);
  };

  // ── Top controls (folder / priority / schedule) ─────────────────────────────────────────────────
  const topControls = (
    <div className="mx-auto max-w-3xl px-1 pb-2">
      <div className="flex flex-wrap gap-2" dir="ltr">
        {/* 1. Schedule (Date + Time block + Repeat + Bucket) */}
        <div className="w-full order-3">
        <Sheet open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit}
              className={`w-full h-11 rounded-xl text-sm font-medium gap-2 justify-center ${isScheduled ? "bg-primary/15 text-primary border-primary/40" : "bg-muted/40 text-foreground hover:bg-muted"}`}
            >
              <Clock className="w-4 h-4" />
              <span className="truncate">{scheduleLabel ?? T("زمان‌بندی", "Schedule")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="w-full max-w-2xl mx-auto rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" aria-describedby="schedule-sheet-desc">
            <SheetHeader className="mb-3">
              <SheetTitle className="text-base">{T("زمان‌بندی تسک", "Task schedule")}</SheetTitle>
            </SheetHeader>
            <Tabs defaultValue="date">
              <TabsList className="grid grid-cols-4 w-full mb-2">
                <TabsTrigger value="date" className="text-[11px] px-1 relative">
                  {T("تاریخ", "Date")}
                  {(t.due_date || t.reminder_at) && <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                </TabsTrigger>
                <TabsTrigger value="block" className="text-[11px] px-1 relative">
                  {T("تایم‌بلاک", "Block")}
                  {hasTimeBlock && <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                </TabsTrigger>
                <TabsTrigger value="repeat" className="text-[11px] px-1 relative">
                  {T("تکرار", "Repeat")}
                  {t.recurrence_rule && <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                </TabsTrigger>
                <TabsTrigger value="bucket" className="text-[11px] px-1 relative">
                  {T("بازه", "Bucket")}
                  {t.bucket_kind && <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="date" className="mt-0 space-y-3">
                <DueDatePicker
                  label=""
                  value={t.due_date}
                  reminderValue={t.reminder_at}
                  onReminderChange={(iso) => save({ reminder_at: iso })}
                  onChange={(iso) => save({ due_date: iso })}
                />
                <div className="border-t pt-2">
                  <label className="text-[10px] text-muted-foreground mb-1.5 block">{T("به تعویق انداختن", "Postpone")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 3, 7].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5"
                        onClick={() => postpone(d)}
                      >
                        {d === 1 ? T("فردا", "Tomorrow") : d === 3 ? T("۳ روز دیگر", "+3 days") : T("هفته آینده", "Next week")}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="block" className="mt-0 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">{T("شروع", "Start")}</label>
                    <Input type="datetime-local" className="h-9 text-xs"
                      value={t.start_at ? t.start_at.slice(0, 16) : ""}
                      onChange={(e) => save({ start_at: e.target.value ? new Date(e.target.value).toISOString() : null } as any)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">{T("پایان", "End")}</label>
                    <Input type="datetime-local" className="h-9 text-xs"
                      value={t.end_at ? t.end_at.slice(0, 16) : ""}
                      onChange={(e) => save({ end_at: e.target.value ? new Date(e.target.value).toISOString() : null } as any)} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[10px] text-muted-foreground whitespace-nowrap">{T("تخمین (دقیقه):", "Estimate:")}</label>
                  <Input type="number" placeholder="—"
                    value={t.estimated_minutes ?? ""}
                    onChange={(e) => save({ estimated_minutes: e.target.value ? Number(e.target.value) : null } as any)}
                    className="h-8 w-20 text-xs" />
                  <div className="flex gap-1">
                    {[15, 30, 60].map(m => (
                      <button key={m} type="button"
                        onClick={() => save({ estimated_minutes: m } as any)}
                        className={`px-2 h-7 text-[10px] rounded-lg border ${t.estimated_minutes === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="repeat" className="mt-0">
                <RecurrenceEditor
                  value={t.recurrence_rule}
                  onChange={(rule) => save({ recurrence_rule: rule } as any)}
                />
              </TabsContent>
              <TabsContent value="bucket" className="mt-0">
                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">
                  {T("بدون زمان دقیق — فقط بازه‌ای که کار باید توش انجام بشه.", "Fuzzy schedule — pick a period instead of an exact time.")}
                </p>
                <BucketPickerBody
                  value={{
                    kind: (t.bucket_kind as any) || null,
                    calendar: (t.bucket_calendar as any) || null,
                    anchor: (t.bucket_anchor as any) || null,
                  }}
                  onChange={(v) => save({
                    bucket_kind: v.kind,
                    bucket_calendar: v.calendar,
                    bucket_anchor: v.anchor,
                  } as any)}
                  onPickTimeOfDay={(hour) => {
                    const d = new Date();
                    d.setHours(hour, 0, 0, 0);
                    save({ due_date: d.toISOString() } as any);
                  }}
                />
              </TabsContent>
            </Tabs>
            <p id="schedule-sheet-desc" className="sr-only">{T("زمان‌بندی تسک", "Task scheduling")}</p>
          </SheetContent>
        </Sheet>
        </div>

        {/* 2. Priority */}
        <div className="flex-1 order-2 min-w-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit}
              className={`w-full h-11 rounded-xl text-sm font-medium gap-2 justify-start px-3 ${t.priority !== "none" ? `${priorityMeta.bgClass} ${priorityMeta.textClass}` : "bg-muted/40 text-foreground hover:bg-muted"}`}
            >
              <Flag className={`w-4 h-4 ${t.priority !== "none" ? priorityMeta.textClass : "text-muted-foreground"}`} />
              <span className="truncate">{t.priority !== "none" ? T(priorityMeta.label, priorityMeta.labelEn) : T("اولویت", "Priority")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2" align="start" side="top">
            <div className="grid grid-cols-2 gap-1.5">
              {PRIORITY_ORDER.map((p) => {
                const m = PRIORITY_META[p];
                const active = t.priority === p;
                return (
                  <button key={p} disabled={!canEdit} onClick={() => save({ priority: p })}
                    className={`px-2 h-9 rounded-xl text-[12px] font-medium transition disabled:opacity-50 disabled:cursor-default ${active ? `${m.bgClass} ${m.textClass}` : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                    {m.emoji} {T(m.label, m.labelEn)}
                  </button>
                );
              })}
            </div>
            {t.priority !== "none" && (
              <button disabled={!canEdit} onClick={() => save({ priority: "none" as Priority })}
                className="w-full mt-2 h-8 rounded-lg text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-default">
                {T("حذف اولویت", "Clear priority")}
              </button>
            )}
            <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Ban className="w-3.5 h-3.5 text-amber-600" /> {T("اجتنابی", "Avoidance")}
              </span>
              <Switch checked={!!t.is_avoidance} onCheckedChange={(v) => save({ is_avoidance: !!v } as any)} />
            </div>
          </PopoverContent>
        </Popover>
        </div>

        {/* 3. Folder + quick-create */}
        <div className="flex-1 order-1 min-w-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit}
              className={`w-full h-11 rounded-xl text-sm font-medium gap-2 justify-start px-3 ${t.folder_id ? "bg-primary/15 text-primary border-primary/40" : "bg-muted/40 text-foreground hover:bg-muted"}`}
            >
              <FolderIcon className="w-4 h-4" style={{ color: t.folder_id ? folders.find(f => f.id === t.folder_id)?.color || undefined : undefined }} />
              <span className="truncate">{t.folder_id ? folderName(t.folder_id) : T("فولدر", "Folder")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 max-h-[55vh] overflow-y-auto" align="start" side="top">
            {isOwner && !showFolderCreate && (
              <button
                onClick={() => setShowFolderCreate(true)}
                className="w-full flex items-center gap-2 p-2 mb-1 rounded-xl bg-muted/40 hover:bg-accent text-sm text-muted-foreground"
              >
                <Plus className="w-4 h-4" /> {T("ساخت فولدر جدید", "Create new folder")}
              </button>
            )}
            {isOwner && showFolderCreate && (
              <>
                <div className="flex items-center gap-1.5 mb-2 p-1.5 rounded-xl bg-muted/40">
                  <span className="w-6 h-6 rounded-md shrink-0" style={{ background: newFolderColor }} />
                  <Input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { createFolderAndAssign(); setShowFolderCreate(false); }
                      if (e.key === "Escape") setShowFolderCreate(false);
                    }}
                    placeholder={T("نام فولدر جدید…", "New folder name…")}
                    className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { await createFolderAndAssign(); setShowFolderCreate(false); }} disabled={!newFolderName.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1 mb-2 px-1">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewFolderColor(c)}
                      className={`w-5 h-5 rounded-full border-2 ${newFolderColor === c ? "border-foreground" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </>
            )}
            <button
              disabled={!isOwner}
              onClick={() => save({ folder_id: null })}
              className={`w-full text-start p-2 rounded-lg text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${t.folder_id === null ? "bg-accent" : ""}`}
            >{T("بدون فولدر (Inbox)", "No folder (Inbox)")}</button>
            {folders.filter(f => !f.parent_id).map(f => {
              const children = folders.filter(c => c.parent_id === f.id);
              return (
                <div key={f.id}>
                  <button
                    onClick={() => save({ folder_id: f.id })}
                    className={`w-full text-start p-2 rounded-lg text-sm hover:bg-accent flex items-center gap-2 ${t.folder_id === f.id ? "bg-accent" : ""}`}
                  >
                    <FolderIcon className="w-3.5 h-3.5" style={{ color: f.color || undefined }} />
                    {f.name}
                  </button>
                  {children.map(c => (
                    <button key={c.id}
                      onClick={() => save({ folder_id: c.id })}
                      className={`w-full text-start p-2 ps-6 rounded-lg text-xs hover:bg-accent flex items-center gap-2 ${t.folder_id === c.id ? "bg-accent" : ""}`}
                    >
                      <FolderIcon className="w-3 h-3" style={{ color: c.color || undefined }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </PopoverContent>
        </Popover>
        </div>
      </div>
    </div>
  );

  // ── Bottom action rail ──────────────────────────────────────────────
  const bottomRail = (
    <div className="mx-auto max-w-3xl px-1 py-2 border-t border-border/40 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-0.5 overflow-x-auto no-scrollbar" dir="rtl">
        <div className="w-full order-4 flex items-center gap-0.5 overflow-x-auto no-scrollbar py-1" dir="rtl">
                {/* 4. Tags + quick-create */}
                <Popover>
                  <PopoverTrigger asChild>
                    <span>
                      <RailButton icon={TagIcon} label={T("تگ", "Tags")} active={taskTagIds.length > 0} badge={taskTagIds.length || undefined} />
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 max-h-[55vh] overflow-y-auto" align="start" side="top">
                    {!showTagCreate ? (
                      <button
                        onClick={() => setShowTagCreate(true)}
                        className="w-full flex items-center gap-2 p-2 mb-1 rounded-xl bg-muted/40 hover:bg-accent text-sm text-muted-foreground"
                      >
                        <Plus className="w-4 h-4" /> {T("ساخت تگ جدید", "Create new tag")}
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mb-2 p-1.5 rounded-xl bg-muted/40">
                          <span className="w-3 h-3 rounded-full shrink-0 ms-1" style={{ background: newTagColor }} />
                          <Input
                            autoFocus
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { createTagAndAssign(); setShowTagCreate(false); }
                              if (e.key === "Escape") setShowTagCreate(false);
                            }}
                            placeholder={T("نام تگ جدید…", "New tag name…")}
                            className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0"
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { await createTagAndAssign(); setShowTagCreate(false); }} disabled={!newTagName.trim()}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex gap-1 mb-2 px-1">
                          {TAG_COLORS.map(c => (
                            <button key={c} onClick={() => setNewTagColor(c)}
                              className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                              style={{ background: c }} />
                          ))}
                        </div>
                      </>
                    )}
                    {tags.map(tg => {
                      const active = taskTagIds.includes(tg.id);
                      return (
                        <button key={tg.id} onClick={() => toggleTag(tg.id)}
                          className={`w-full text-start p-2 rounded-lg text-sm hover:bg-accent flex items-center justify-between gap-2 ${active ? "bg-accent" : ""}`}>
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: tg.color || "hsl(var(--muted-foreground))" }} />
                            {tg.name}
                          </span>
                          {active && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>

                {/* 5. Attachments — pick file type first */}
                <Popover>
                  <PopoverTrigger asChild>
                    <span>
                      <RailButton icon={Paperclip} label={T("ضمیمه", "Attach")} active={showAttachments} disabled={!canEdit} />
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start" side="top">
                    <div className="grid grid-cols-2 gap-1.5">
                      <AttachTypeBtn icon={ImageIcon} label={T("تصویر", "Image")} onClick={() => pickFileType("image/*")} />
                      <AttachTypeBtn icon={Music} label={T("صدا", "Audio")} onClick={() => pickFileType("audio/*")} />
                      <AttachTypeBtn icon={FileText} label={T("سند", "Document")} onClick={() => pickFileType("application/pdf,.doc,.docx,.txt")} />
                      <AttachTypeBtn icon={Paperclip} label={T("هر فایلی", "Any file")} onClick={() => pickFileType("*/*")} />
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <Input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && attachLink()}
                        placeholder={T("https://…", "https://…")}
                        className="h-8 text-xs"
                        dir="ltr"
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={attachLink} disabled={!linkUrl.trim()}>
                        {T("افزودن", "Add")}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Link parent task */}
                <Popover open={parentOpen} onOpenChange={setParentOpen}>
                  <PopoverTrigger asChild>
                    <span>
                      <RailButton icon={ListTree} label={T("تسک والد", "Parent")} active={!!t.parent_id} disabled={!canEdit} />
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 max-h-[55vh] overflow-y-auto" align="start" side="top">
                    <button
                      disabled={!isOwner || t.parent_id === null}
                      onClick={() => { save({ parent_id: null }); setParentOpen(false); }}
                      className={`w-full text-start p-2 rounded-lg text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${t.parent_id === null ? "bg-accent" : ""}`}
                    >
                      {T("بدون والد (سطح بالا)", "No parent (top-level)")}
                    </button>
                    {parentCandidates.map((c) => (
                      <button
                        key={c.id}
                        disabled={!canEdit || c.id === t.parent_id}
                        onClick={() => { save({ parent_id: c.id }); setParentOpen(false); }}
                        className={`w-full text-start p-2 rounded-lg text-sm hover:bg-accent truncate disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${t.parent_id === c.id ? "bg-accent" : ""}`}
                      >
                        {c.title || T("بدون عنوان", "Untitled")}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* 6. Items: Subtasks, Steps or Branches */}
                <Popover>
                  <PopoverTrigger asChild>
                    <span>
                      <RailButton
                        icon={ListChecks}
                        label={T("آیتم‌ها", "Items")}
                        active={showSubtasks || showSteps || showOutcomes}
                        badge={outcomeCount || undefined}
                        disabled={!(canEdit || canComment)}
                      />
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1.5" align="start" side="top">
                    <button
                      onClick={() => setShowSubtasks(s => !s)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-sm hover:bg-accent ${showSubtasks ? "bg-accent" : ""}`}
                    >
                      <ListTree className="w-4 h-4 text-primary" />
                      <span className="flex-1 text-start">{T("زیرتسک", "Subtask")}</span>
                      {showSubtasks && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setShowSteps(s => !s)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-sm hover:bg-accent ${showSteps ? "bg-accent" : ""}`}
                    >
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                      <span className="flex-1 text-start">{T("مرحله / چک‌لیست", "Step / checklist")}</span>
                      {showSteps && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setShowOutcomes(s => !s)}
                      disabled={!canEdit}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${showOutcomes ? "bg-accent" : ""}`}
                    >
                      <GitBranch className="w-4 h-4 text-amber-500" />
                      <span className="flex-1 text-start">{T("شاخه‌ها", "Branches")}</span>
                      {outcomeCount > 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">{outcomeCount}</span>
                      )}
                      {showOutcomes && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </PopoverContent>
                </Popover>

                {/* AI */}
                <RailButton
                  icon={Sparkles}
                  label="AI"
                  accent
                  onClick={() => setAiOpen(true)}
                  disabled={!canEdit}
                />

                {allowDelete && canEdit && (
                  <>
                    <span className="w-px h-5 bg-border/60 mx-0.5" />
                    <RailButton
                      icon={Trash2}
                      label={T("حذف", "Delete")}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={deleteTask}
                    />
                  </>
                )}
                </div>
      </div>
    </div>
  );

  // ── Expandable inline blocks (only when toggled) ────────────────────
  const expandables = (
    <div className="space-y-3 px-1">


      {showSubtasks && (
        <TaskSubtasksInline
          taskId={t.id}
          readOnly={!canEdit}
          onOpenSubtask={(id) => {
            supabase.from("tasks").select("*").eq("id", id).single().then(({ data }) => {
              if (data) { onChanged(); setT(data as any); }
            });
          }}
        />
      )}

      {showSteps && <TaskStepLists taskId={t.id} />}

      {showOutcomes && <TaskOutcomesInline taskId={t.id} refreshKey={outcomeRefresh} onEdit={() => setOutcomeOpen(true)} />}

      {showAttachments && <TaskAttachments taskId={t.id} />}

      {showNotes && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> {T("نوت‌ها", "Notes")} ({taskNotes.length})
            </label>
            <Button size="sm" variant="outline" onClick={addNote} disabled={!canEdit} className="gap-1 rounded-full h-7 text-xs">
              <Plus className="w-3 h-3" /> {T("جدید", "New")}
            </Button>
          </div>
          <div className="space-y-1">
            {taskNotes.map((n) => (
              <Card key={n.id} className="p-1.5 flex items-center gap-2 rounded-lg bg-card/50">
                <button className="flex-1 text-start text-sm truncate px-1" onClick={() => setActiveNote(n)}>
                  <BidiText text={n.title} />
                </button>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => askDelNote(n)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const body = (
    <div className="mt-1 task-detail-sections flex flex-col min-h-[40vh]">
      {topControls}
      {hero}
      {quickChips}
      <div className="flex-1">{expandables}</div>
      {bottomRail}
    </div>
  );

  const noteEditorBody = activeNote && (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setActiveNote(null)} className="gap-1">
          <ArrowRight className="w-4 h-4" />
          {T("بازگشت به تسک", "Back to task")}
        </Button>
      </div>
      <Input
        value={activeNote.title}
        readOnly={!canEdit}
        onChange={(e) => saveNote(activeNote.id, { title: e.target.value })}
        className="border-none focus-visible:ring-0 px-0 text-lg font-semibold"
        dir="auto"
      />
      <NoteEditorTabs
        noteId={activeNote.id}
        readOnly={!canEdit}
        markdown={activeNote.content || ""}
        onChange={(md) => saveNote(activeNote.id, { content: md })}
      />
    </div>
  );

  const drawerHeader = (snap === 1 && isMobile) ? null : (
    <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0">
      <span className="sr-only">{activeNote ? T("ویرایش نوت", "Edit note") : T("جزئیات تسک", "Task")}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} title={T("بستن", "Close")}>
          <X className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => { setSnap(snap === 1 ? 0.5 : 1); }}
          title={snap === 1 ? T("کوچک‌نمایی", "Collapse") : T("فول اسکرین", "Full screen")}
        >
          {snap === 1 ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {mode === "page" ? (
        <div className="w-full max-w-3xl mx-auto px-2 sm:px-3 md:px-4 py-2 pb-4 min-h-screen flex flex-col">
          {activeNote ? noteEditorBody : body}
        </div>
      ) : mode === "drawer" ? (
        <Drawer open={true} onOpenChange={(v) => !v && onClose()} snapPoints={[0.5, 1]} activeSnapPoint={snap} setActiveSnapPoint={setSnap} shouldScaleBackground={false} dismissible>
          <DrawerContent className={`h-screen max-h-screen flex flex-col !mt-0 ${snap === 1 ? "!m-0 !rounded-none" : "min-h-[55vh]"}`} aria-describedby="task-drawer-desc">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{activeNote ? T("ویرایش نوت", "Edit note") : T("جزئیات تسک", "Task")}</DrawerTitle>
            </DrawerHeader>
            {drawerHeader}
            <div className={`flex-1 overflow-y-auto min-h-0 px-3 pb-4 ${snap === 1 ? "" : "max-h-[50vh]"}`}>
              {activeNote ? noteEditorBody : body}
            </div>
            <p id="task-drawer-desc" className="sr-only">{T("جزئیات و ویرایش تسک", "Task details and editing")}</p>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={true} onOpenChange={(v) => !v && onClose()}>
          <SheetContent className="w-full sm:max-w-full overflow-y-auto p-3 sm:p-4 flex flex-col">
            <SheetHeader className="mb-1">
              <SheetTitle className="sr-only">
                {activeNote ? T("ویرایش نوت", "Edit note") : T("جزئیات تسک", "Task")}
              </SheetTitle>
            </SheetHeader>
            {activeNote ? noteEditorBody : body}
          </SheetContent>
        </Sheet>
      )}

      <TaskAIPanel
        task={t as any}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onMetaApplied={refreshTask}
      />

      <TaskOutcomeSheet
        task={t}
        open={outcomeOpen}
        onOpenChange={(open) => { setOutcomeOpen(open); if (!open) { refreshTask(); refreshOutcomeCount(); } }}
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      />
    </>
  );
}

function AttachTypeBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg bg-muted/40 hover:bg-accent active:scale-95 transition"
    >
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

