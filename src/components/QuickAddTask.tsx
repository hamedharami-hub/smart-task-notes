import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Calendar as CalendarIcon, CalendarClock, Tag, Folder, Flag, Image as ImageIcon, MoreHorizontal, LayoutTemplate, FileText, Maximize2, Settings, Save, Check, X } from "lucide-react";
import { parseNaturalDate } from "@/lib/nlDate";
import { toPersianDigits } from "@/lib/persianDigits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DueDatePicker } from "@/components/DueDatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PRIORITY_META, PRIORITY_SELECTABLE, type Priority } from "@/lib/priority";
import type { Task } from "@/lib/taskTypes";
import { listTaskTemplates, buildTaskFromTemplate } from "@/lib/taskTemplates";
import { uploadMediaFull } from "@/lib/uploadMedia";
import { VoiceInputButton } from "@/components/VoiceInputButton";

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

  const submit = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
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
      await supabase.from("task_templates").insert({
        user_id: user.id,
        title: finalTitle,
        priority: finalPriority,
        folder_id: finalFolderId,
        due_offset_hours: finalDue ? Math.round((new Date(finalDue).getTime() - Date.now()) / 3600000) : null,
      } as never);
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

  const hintItems: { icon: typeof CalendarClock; label: string }[] = [];
  if (finalDue) {
    hintItems.push({
      icon: CalendarClock,
      label: new Date(finalDue).toLocaleDateString(isEn ? "en-US" : "fa-IR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    });
  }
  if (finalFolderId) {
    hintItems.push({ icon: Folder, label: `@${folders.find(f => f.id === finalFolderId)?.name || ""}` });
  }
  finalTagIds.forEach(id => {
    const tg = tags.find(t => t.id === id);
    if (tg) hintItems.push({ icon: Tag, label: `#${tg.name}` });
  });
  if (finalPriority && finalPriority !== "none") {
    const pMeta = PRIORITY_META[finalPriority];
    hintItems.push({ icon: Flag, label: `!${T(pMeta.label, pMeta.labelEn)}` });
  }

  const ToolbarBtn = ({ icon: Icon, active, onClick, title: t, badge }: { icon: typeof CalendarIcon; active?: boolean; onClick?: () => void; title?: string; badge?: number }) => (
    <button
      type="button"
      onClick={onClick}
      title={t}
      className={`relative p-1.5 rounded-lg transition ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon className="w-4 h-4" />
      {badge ? <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[9px] bg-primary text-primary-foreground rounded-full flex items-center justify-center">{badge}</span> : null}
    </button>
  );

  return (
    <div className={`${className}`} dir={isEn ? "ltr" : "rtl"}>
      <div className="flex gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholderText}
          className="flex-1 h-10 text-sm bg-background"
          dir="auto"
          disabled={busy}
        />
        <VoiceInputButton
          onTranscript={(text) => setTitle((prev) => (prev ? prev.trimEnd() + " " + text : text))}
          disabled={busy}
          size="icon"
          className="h-10 w-10 shrink-0"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              title={T("تاریخ", "Date")}
              className={`h-10 w-10 shrink-0 ${due ? "border-primary text-primary" : ""}`}
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="end">
            <DueDatePicker value={due} onChange={setDue} compact />
          </PopoverContent>
        </Popover>
        <Button onClick={submit} disabled={busy || !title.trim()} size="icon" title={T("افزودن", "Add")} className="h-10 w-10 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <span><ToolbarBtn icon={Flag} active={!!(finalPriority && finalPriority !== "none")} title={T("اولویت", "Priority")} /></span>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1.5" align="start">
            {PRIORITY_SELECTABLE.map(p => {
              const m = PRIORITY_META[p as Priority];
              return (
                <button
                  key={p}
                  onClick={() => applyPriority(p as Priority)}
                  className={`w-full text-start px-2 py-1.5 text-xs rounded flex items-center gap-2 ${finalPriority === p ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  <Flag className={`w-3 h-3 ${m.textClass}`} /> {T(m.label, m.labelEn)}
                </button>
              );
            })}
            <button onClick={() => applyPriority("none")} className="w-full text-start px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground border-t mt-1">
              {T("بدون اولویت", "No priority")}
            </button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <span><ToolbarBtn icon={Tag} active={finalTagIds.length > 0} title={T("تگ", "Tag")} badge={finalTagIds.length || undefined} /></span>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1.5" align="start">
            {tags.map(t => (
              <button
                key={t.id}
                onClick={() => finalTagIds.includes(t.id) ? removeTag(t.id) : applyTag(t.id)}
                className={`w-full text-start px-2 py-1.5 text-xs rounded flex items-center gap-2 ${finalTagIds.includes(t.id) ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color || "#888" }} />
                {t.name} {finalTagIds.includes(t.id) && <Check className="w-3 h-3 ms-auto" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <span><ToolbarBtn icon={Folder} active={!!finalFolderId} title={T("فولدر", "Folder")} /></span>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1.5" align="start">
            <button onClick={() => applyFolder(null)} className={`w-full text-start px-2 py-1.5 text-xs rounded ${finalFolderId === null ? "bg-accent" : "hover:bg-accent/50"}`}>
              {T("بدون فولدر (Inbox)", "No folder (Inbox)")}
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => applyFolder(f.id)}
                className={`w-full text-start px-2 py-1.5 text-xs rounded ${finalFolderId === f.id ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                {f.name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <ToolbarBtn icon={ImageIcon} active={selectedFiles.length > 0} onClick={() => fileRef.current?.click()} title={T("تصویر/ضمیمه", "Image/Attachment")} badge={selectedFiles.length || undefined} />
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,application/pdf,text/plain" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />

        <ToolbarBtn icon={MoreHorizontal} active={moreOpen} onClick={() => setMoreOpen(true)} title={T("بیشتر", "More")} />
      </div>

      {hintItems.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-primary animate-fade-in">
          {hintItems.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-0.5">
              <item.icon className="w-3 h-3" />
              <span>{toPersianDigits(item.label)}</span>
            </span>
          ))}
          <span className="text-muted-foreground">— Enter = {T("ثبت", "save")}</span>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedFiles.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted">
              {f.name}
              <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}

      {/* More / Template sheets */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6 px-3 pt-4 max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{T("گزینه‌های بیشتر", "More Options")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-1 mt-4">
            <MoreRow icon={LayoutTemplate} label={T("انتخاب تمپلیت", "Choose Template")} onClick={() => setTemplateOpen(true)} />
            <MoreRow icon={Save} label={T("ذخیره به‌عنوان تمپلیت", "Save as Template")} onClick={saveAsTemplate} />
            <MoreRow icon={FileText} label={T("تبدیل به نوت", "Convert to Note")} onClick={convertToNote} />
            <MoreRow icon={Maximize2} label={T("نمایش کامل", "Full Screen")} onClick={openFullScreen} />
            <MoreRow icon={Settings} label={T("تنظیمات", "Settings")} onClick={() => navigate("/app/settings")} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={templateOpen} onOpenChange={setTemplateOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6 px-3 pt-4 max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{T("تمپلیت‌ها", "Templates")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 mt-4">
            {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{T("تمپلیتی نیست", "No templates yet")}</p>}
            {templates.map((tpl, i) => (
              <button key={i} onClick={() => applyTemplate(tpl)} className="w-full text-start px-3 py-2.5 rounded-lg hover:bg-muted text-sm border">
                {tpl.title}
                {tpl.priority && tpl.priority !== "none" && <span className="ms-2 text-[10px] text-muted-foreground">{T(PRIORITY_META[tpl.priority].label, PRIORITY_META[tpl.priority].labelEn)}</span>}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MoreRow({ icon: Icon, label, onClick }: { icon: typeof CalendarIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition text-sm">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
