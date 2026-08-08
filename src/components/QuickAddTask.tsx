import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Plus, Loader2, Calendar as CalendarIcon, Tag, Folder, Flag, Check } from "lucide-react";
import { parseNaturalDate } from "@/lib/nlDate";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DueDatePicker } from "@/components/DueDatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PRIORITY_META, PRIORITY_SELECTABLE, type Priority } from "@/lib/priority";
import type { Task } from "@/lib/taskTypes";
import { listTaskTemplates, buildTaskFromTemplate } from "@/lib/taskTemplates";
import { uploadMediaFull } from "@/lib/uploadMedia";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { enqueueOp } from "@/lib/offlineQueue";

type Defaults = {
  folder_id?: string | null;
  due_date?: string | null;
  parent_id?: string | null;
  tag_id?: string | null;
};

const priorityKeywords: Record<string, Priority> = {
  "0": "none", "none": "none", "n": "none", "هیچ": "none", "بدون": "none",
  "1": "urgent", "urgent": "urgent", "u": "urgent", "فوق": "urgent", "فوق‌فوری": "urgent",
  "2": "high", "high": "high", "h": "high", "بالا": "high", "فوری": "high",
  "3": "medium", "medium": "medium", "m": "medium", "متوسط": "medium",
  "4": "low", "low": "low", "l": "low", "پایین": "low",
};

const priorityEngKey: Record<Priority, string> = {
  none: "none",
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
};

export function QuickAddTask({
  defaults = {},
  placeholder,
  onCreated,
  className = "",
}: {
  defaults?: Defaults;
  placeholder?: string;
  onCreated?: (taskId: string) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const placeholderText = placeholder || T("+ تسک جدید...", "+ New task...");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [due, setDue] = useState<string | null>(defaults.due_date ?? null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [folderId, setFolderId] = useState<string | null>(defaults.folder_id ?? null);
  const [tagIds, setTagIds] = useState<string[]>(defaults.tag_id ? [defaults.tag_id] : []);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [templates, setTemplates] = useState<Partial<Task>[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("folders").select("id,name").order("name").then(({ data }) => setFolders(data || []));
    supabase.from("tags").select("id,name,color").order("name").then(({ data }) => setTags(data || []));
    listTaskTemplates(user.id).then((tpls) => {
      setTemplates(tpls.map(t => buildTaskFromTemplate(t)));
    }).catch(() => {});
  }, [user]);

  // Live natural-language parsing: date, #tag, @folder, !priority.
  const parsed = useMemo(() => {
    const tokens = title.trim().split(/\s+/).filter(Boolean);
    const kept: string[] = [];
    const matchedTagIds: string[] = [];
    let matchedFolderId: string | null = null;
    let matchedPriority: Priority | null = null;

    for (const token of tokens) {
      if (token.startsWith("#")) {
        const name = token.slice(1).trim();
        const tag = tags.find(tg => tg.name.toLowerCase() === name.toLowerCase());
        if (tag) matchedTagIds.push(tag.id);
        continue;
      }
      if (token.startsWith("@")) {
        const name = token.slice(1).trim().toLowerCase();
        const folder = folders.find(f => f.name.toLowerCase() === name);
        if (folder) matchedFolderId = folder.id;
        continue;
      }
      if (token.startsWith("!")) {
        const key = token.slice(1).trim().toLowerCase();
        if (priorityKeywords[key]) matchedPriority = priorityKeywords[key];
        continue;
      }
      kept.push(token);
    }

    const tokenClean = kept.join(" ");
    const dateParsed = parseNaturalDate(tokenClean);
    return {
      title: dateParsed.cleanedTitle.trim() || title.trim(),
      dueDate: dateParsed.dueDate,
      tagIds: matchedTagIds,
      folderId: matchedFolderId,
      priority: matchedPriority,
    };
  }, [title, folders, tags]);

  const finalDue = due ?? defaults.due_date ?? parsed.dueDate ?? null;
  const finalTitle = parsed.title;
  const finalPriority = priority ?? parsed.priority ?? "none";
  const finalFolderId = folderId ?? parsed.folderId ?? defaults.folder_id ?? null;
  const finalTagIds = Array.from(new Set([
    ...(defaults.tag_id ? [defaults.tag_id] : []),
    ...tagIds,
    ...parsed.tagIds,
  ]));

  const generateId = () => {
    try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  };

  const submit = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);

    const tempId = generateId();
    const baseTask = {
      id: tempId,
      user_id: user.id,
      title: finalTitle,
      folder_id: finalFolderId,
      due_date: finalDue,
      parent_id: defaults.parent_id ?? null,
      priority: finalPriority,
      completed: false,
      status: "todo" as const,
      created_at: new Date().toISOString(),
      position: 0,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Offline: queue task and tags. Attachments cannot be uploaded offline and are skipped.
      try {
        await enqueueOp({ table: "tasks", op: "insert", payload: baseTask });
        if (finalTagIds.length) {
          await enqueueOp({
            table: "task_tags",
            op: "insert",
            payload: finalTagIds.map(tag_id => ({ task_id: tempId, tag_id, user_id: user.id })),
          });
        }
        if (selectedFiles.length) {
          toast.info(T("پیوست‌ها در حالت آفلاین ذخیره نمی‌شوند", "Attachments are not saved while offline"));
        }
        setTitle("");
        setDue(defaults.due_date ?? null);
        setPriority(null);
        setFolderId(defaults.folder_id ?? null);
        setTagIds(defaults.tag_id ? [defaults.tag_id] : []);
        setSelectedFiles([]);
        window.dispatchEvent(new Event("tasks-changed"));
        onCreated?.(tempId);
        toast.success(T("تسک ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Task saved — will sync when online"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: finalTitle,
          folder_id: finalFolderId,
          due_date: finalDue,
          parent_id: defaults.parent_id ?? null,
          priority: finalPriority,
        } as never)
        .select()
        .single();
      if (error) throw error;
      if (data && finalTagIds.length) {
        await supabase
          .from("task_tags")
          .insert(finalTagIds.map(tag_id => ({ task_id: data.id, tag_id, user_id: user.id })));
      }
      if (data && selectedFiles.length) {
        for (const file of selectedFiles) {
          if (file.size > 50 * 1024 * 1024) continue;
          const up = await uploadMediaFull(file, user.id);
          await supabase.from("task_attachments").insert({
            user_id: user.id,
            task_id: data.id,
            url: up.url,
            storage_path: up.path,
            file_name: up.name,
            mime_type: up.mime,
            kind: up.kind,
            size_bytes: up.size,
          });
        }
      }
      setTitle("");
      setDue(defaults.due_date ?? null);
      setPriority(null);
      setFolderId(defaults.folder_id ?? null);
      setTagIds(defaults.tag_id ? [defaults.tag_id] : []);
      setSelectedFiles([]);
      window.dispatchEvent(new Event("tasks-changed"));
      if (data) onCreated?.(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const applyPriority = (p: Priority) => {
    setPriority(p);
    // Remove any existing explicit priority token from title and append new one
    const clean = title.split(/\s+/).filter(w => !w.startsWith("!")).join(" ");
    if (p === "none") {
      setTitle(clean);
    } else {
      setTitle(`${clean} !${priorityEngKey[p]}`.trim());
    }
  };

  const applyFolder = (fid: string | null) => {
    setFolderId(fid);
    const currentFolder = folders.find(f => f.id === fid);
    const clean = title.split(/\s+/).filter(w => !w.startsWith("@")).join(" ");
    if (currentFolder) {
      setTitle(`${clean} @${currentFolder.name}`.trim());
    } else {
      setTitle(clean);
    }
  };

  const applyTag = (tid: string) => {
    const tag = tags.find(t => t.id === tid);
    if (!tag || finalTagIds.includes(tid)) return;
    setTagIds(prev => [...prev, tid]);
    setTitle(`${title} #${tag.name}`.trim());
  };

  const removeTag = (tid: string) => {
    setTagIds(prev => prev.filter(id => id !== tid));
    const tag = tags.find(t => t.id === tid);
    if (tag) setTitle(title.split(/\s+/).filter(w => w.toLowerCase() !== `#${tag.name.toLowerCase()}`).join(" "));
  };

  const applyTemplate = (tpl: Partial<Task>) => {
    if (tpl.title) setTitle(tpl.title);
    if (tpl.due_date) setDue(tpl.due_date);
    if (tpl.priority) setPriority(tpl.priority);
    if (tpl.folder_id) setFolderId(tpl.folder_id);
    setTemplateOpen(false);
    setMoreOpen(false);
  };

  const convertToNote = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOp({
          table: "notes",
          op: "insert",
          payload: {
            id: generateId(),
            user_id: user.id,
            title: finalTitle,
            content: "",
            folder_id: finalFolderId,
            pinned: false,
            updated_at: new Date().toISOString(),
          },
        });
        setTitle("");
        toast.success(T("نوت ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Note saved — will sync when online"));
        navigate("/app/notes");
        return;
      }
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: finalTitle,
        content: "",
        folder_id: finalFolderId,
      });
      if (error) throw error;
      setTitle("");
      toast.success(T("نوت ساخته شد", "Note created"));
      navigate("/app/notes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!user || !title.trim()) return;
    try {
      const payload = {
        id: generateId(),
        user_id: user.id,
        title: finalTitle,
        priority: finalPriority,
        folder_id: finalFolderId,
        due_offset_hours: finalDue ? Math.round((new Date(finalDue).getTime() - Date.now()) / 3600000) : null,
      };
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOp({ table: "task_templates", op: "insert", payload });
        toast.success(T("ذخیره شد؛ با اتصال اینترنت همگام می‌شود", "Saved — will sync when online"));
        setMoreOpen(false);
        return;
      }
      await supabase.from("task_templates").insert(payload as never);
      toast.success(T("ذخیره شد در تمپلیت‌ها", "Saved to templates"));
      setMoreOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    }
  };

  const openFullScreen = () => {
    const qp = new URLSearchParams();
    if (title.trim()) qp.set("title", finalTitle);
    if (finalDue) qp.set("due_date", finalDue);
    if (finalFolderId) qp.set("folder_id", finalFolderId);
    navigate(`/app/new/task?${qp.toString()}`);
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const formatDueShort = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(isEn ? "en-US" : "fa-IR", { month: "short", day: "numeric" });
  };

  const selectedFolder = folders.find(f => f.id === finalFolderId);
  const selectedTag = finalTagIds.length === 1 ? tags.find(t => t.id === finalTagIds[0]) : null;

  return (
    <div className={`${className}`} dir={isEn ? "ltr" : "rtl"}>
      {/* Top param selectors: date / priority / folder / tag */}
      <div className="flex items-center gap-1.5 flex-nowrap mb-1.5 overflow-x-auto no-scrollbar">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={finalDue ? formatDueShort(finalDue) : T("تاریخ", "Date")}
              aria-label={T("تاریخ", "Date")}
              className={`h-9 w-9 shrink-0 rounded-full ${finalDue ? "border-primary text-primary" : ""}`}
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>

          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3 p-3" align="start">
            <DueDatePicker value={due} onChange={setDue} compact />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={finalPriority !== "none" ? T(PRIORITY_META[finalPriority].label, PRIORITY_META[finalPriority].labelEn) : T("اولویت", "Priority")}
              aria-label={T("اولویت", "Priority")}
              className={`h-9 w-9 shrink-0 rounded-full ${finalPriority !== "none" ? "border-primary" : ""}`}
            >
              <Flag className={`w-4 h-4 ${finalPriority !== "none" ? PRIORITY_META[finalPriority].textClass : ""}`} />
            </Button>

          </PopoverTrigger>
          <PopoverContent className="w-48 p-1.5" align="start">
            {PRIORITY_SELECTABLE.map(p => {
              const m = PRIORITY_META[p as Priority];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPriority(p as Priority)}
                  className={`w-full text-start px-2 py-1.5 text-xs rounded flex items-center gap-2 ${finalPriority === p ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  <Flag className={`w-3 h-3 ${m.textClass}`} /> {T(m.label, m.labelEn)}
                </button>
              );
            })}
            <button type="button" onClick={() => applyPriority("none")} className="w-full text-start px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground border-t mt-1">
              {T("بدون اولویت", "No priority")}
            </button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={selectedFolder ? selectedFolder.name : T("فولدر", "Folder")}
              aria-label={T("فولدر", "Folder")}
              className={`h-9 w-9 shrink-0 rounded-full ${finalFolderId ? "border-primary text-primary" : ""}`}
            >
              <Folder className="w-4 h-4" />
            </Button>

          </PopoverTrigger>
          <PopoverContent className="w-56 p-1.5" align="start">
            <button type="button" onClick={() => applyFolder(null)} className={`w-full text-start px-2 py-1.5 text-xs rounded ${finalFolderId === null ? "bg-accent" : "hover:bg-accent/50"}`}>
              {T("بدون فولدر (Inbox)", "No folder (Inbox)")}
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFolder(f.id)}
                className={`w-full text-start px-2 py-1.5 text-xs rounded ${finalFolderId === f.id ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                {f.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={T("تگ", "Tag")}
              className={`h-8 gap-1.5 rounded-lg text-xs px-2.5 ${finalTagIds.length ? "border-primary text-primary" : ""}`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{finalTagIds.length ? (selectedTag ? selectedTag.name : `+${finalTagIds.length}`) : T("تگ", "Tag")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1.5" align="start">
            {tags.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => finalTagIds.includes(t.id) ? removeTag(t.id) : applyTag(t.id)}
                className={`w-full text-start px-2 py-1.5 text-xs rounded flex items-center gap-2 ${finalTagIds.includes(t.id) ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color || "#888" }} />
                {t.name} {finalTagIds.includes(t.id) && <Check className="w-3 h-3 ms-auto" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Title input */}
      <div className="flex gap-1.5">
        <AutoTextarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholderText}
          className="flex-1 text-sm bg-background min-h-[44px] max-h-[160px] py-2.5"
          dir="auto"
          disabled={busy}
          rows={1}
          minHeight={44}
          maxHeight={160}
        />
        <VoiceInputButton
          onTranscript={(text) => setTitle((prev) => (prev ? prev.trimEnd() + " " + text : text))}
          disabled={busy}
          size="icon"
          className="h-11 w-11 shrink-0"
        />
        <Button onClick={submit} disabled={busy || !title.trim()} size="icon" title={T("افزودن", "Add")} className="h-11 w-11 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
