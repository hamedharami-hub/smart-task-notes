import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseNaturalDate } from "@/lib/nlDate";
import { PRIORITY_META, PRIORITY_SELECTABLE, type Priority } from "@/lib/priority";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DueDatePicker } from "@/components/DueDatePicker";
import { Calendar, Flag, Folder as FolderIcon, ListTodo, FileText, X, Loader2 } from "lucide-react";

const priorityKeywords: Record<string, Priority> = {
  urgent: "urgent", u: "urgent", فوق: "urgent", "فوق‌فوری": "urgent",
  high: "high", h: "high", بالا: "high", فوری: "high",
  medium: "medium", m: "medium", متوسط: "medium",
  low: "low", l: "low", پایین: "low",
};

export default function QuickCaptureDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"task" | "note">("task");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const [due, setDue] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("none");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string; color: string | null }[]>([]);

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.key === "n" || e.key === "N") && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", keyHandler);
    window.addEventListener("lov:open-quick-capture", openHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
      window.removeEventListener("lov:open-quick-capture", openHandler);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setTab("task");
      setDue(null);
      setPriority("none");
      setFolderId(null);
      return;
    }
    if (!user) return;
    supabase.from("folders").select("id,name,color").eq("user_id", user.id).order("name").then(({ data }) => {
      setFolders((data || []) as { id: string; name: string; color: string | null }[]);
    });
  }, [open, user]);

  // Parse natural date + !priority + @folder tokens from the title.
  const parsed = useMemo(() => {
    const tokens = title.trim().split(/\s+/).filter(Boolean);
    const kept: string[] = [];
    let parsedPriority: Priority | null = null;
    let parsedFolder: string | null = null;

    for (const token of tokens) {
      if (token.startsWith("!")) {
        const key = token.slice(1).trim().toLowerCase();
        if (priorityKeywords[key]) parsedPriority = priorityKeywords[key];
        continue;
      }
      if (token.startsWith("@")) {
        const name = token.slice(1).trim().toLowerCase();
        const folder = folders.find((f) => f.name.toLowerCase() === name);
        if (folder) parsedFolder = folder.id;
        continue;
      }
      kept.push(token);
    }

    const tokenClean = kept.join(" ");
    const dateParsed = parseNaturalDate(tokenClean);
    return {
      title: dateParsed.dueDate ? dateParsed.cleanedTitle : tokenClean,
      dueDate: dateParsed.dueDate,
      priority: parsedPriority,
      folderId: parsedFolder,
    };
  }, [title, folders]);

  // Manual selection wins over parsed tokens; only adopt parsed values when user hasn't explicitly set them.
  useEffect(() => {
    if (parsed.dueDate && !due) setDue(parsed.dueDate);
    if (parsed.priority && priority === "none") setPriority(parsed.priority);
    if (parsed.folderId && !folderId) setFolderId(parsed.folderId);
  }, [parsed.dueDate, parsed.priority, parsed.folderId, due, priority, folderId]);

  const finalDue = due ?? parsed.dueDate;
  const finalTitle = parsed.title.trim() || title.trim();
  const finalPriority = priority;
  const finalFolderId = folderId ?? parsed.folderId;

  const formatDue = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(isEn ? "en-US" : "fa-IR", { month: "short", day: "numeric" });
  };

  const applyPriority = (p: Priority) => {
    setPriority(p);
    // Remove priority token from title if present
    setTitle((prev) => prev.split(/\s+/).filter((w) => !w.startsWith("!")).join(" "));
  };

  const applyFolder = (fid: string | null) => {
    setFolderId(fid);
    setTitle((prev) => prev.split(/\s+/).filter((w) => !w.startsWith("@")).join(" "));
  };

  const submit = async () => {
    if (!user || !finalTitle) return;
    setBusy(true);
    try {
      if (tab === "task") {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: finalTitle,
            due_date: finalDue,
            priority: finalPriority,
            folder_id: finalFolderId,
          })
          .select()
          .single();
        if (error) throw error;
        toast.success(finalDue ? T("تسک با تاریخ ساخته شد", "Task created with date") : T("تسک ساخته شد", "Task created"));
        window.dispatchEvent(new Event("tasks-changed"));
        setOpen(false);
        if (data) navigate(`/app/tasks/${data.id}`);
      } else {
        const { data, error } = await supabase
          .from("notes")
          .insert({ user_id: user.id, title: finalTitle, content: "" })
          .select()
          .single();
        if (error) throw error;
        toast.success(T("نوت ساخته شد", "Note created"));
        setOpen(false);
        navigate("/app/notes");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const selectedFolder = folders.find((f) => f.id === finalFolderId);
  const dueLabel = formatDue(finalDue);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 pb-8" dir={isEn ? "ltr" : "rtl"}>
        <SheetHeader className="px-0">
          <SheetTitle className="text-base">{T("ثبت سریع", "Quick Capture")}</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 mt-3 bg-muted/50 rounded-xl">
          <button
            type="button"
            onClick={() => setTab("task")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition ${
              tab === "task" ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <ListTodo className="w-4 h-4" />
            {T("تسک", "Task")}
          </button>
          <button
            type="button"
            onClick={() => setTab("note")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition ${
              tab === "note" ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <FileText className="w-4 h-4" />
            {T("نوت", "Note")}
          </button>
        </div>

        {/* Title */}
        <div className="mt-4">
          <AutoTextarea
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={tab === "task" ? T("چه کاری باید انجام شود؟", "What needs to be done?") : T("عنوان نوت...", "Note title...")}
            dir="auto"
            disabled={busy}
            rows={1}
            minHeight={48}
            maxHeight={160}
            className="text-base font-medium min-h-[48px] max-h-[160px] py-3 bg-muted/40 border border-border rounded-xl px-3"
          />
        </div>

        {/* Task quick params */}
        {tab === "task" && (
          <div className="mt-4 space-y-3">
            {/* Date */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-16 shrink-0">{T("زمان", "Date")}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 justify-start gap-2 rounded-lg ${finalDue ? "border-primary text-primary" : ""}`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="truncate">
                      {dueLabel || T("انتخاب تاریخ", "Pick a date")}
                    </span>
                    {finalDue && (
                      <span className="ms-auto">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDue(null); }}
                          className="p-0.5 rounded hover:bg-muted"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-3 p-3" align="start" side="top">
                  <DueDatePicker value={due} onChange={setDue} compact />
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div className="flex items-start gap-3">
              <span className="text-sm text-muted-foreground w-16 shrink-0 pt-2">{T("اولویت", "Priority")}</span>
              <div className="flex-1 flex flex-wrap gap-1.5">
                {PRIORITY_SELECTABLE.map((p) => {
                  const m = PRIORITY_META[p];
                  const active = finalPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPriority(active ? "none" : p)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                        active
                          ? `${m.bgClass} ${m.textClass} border-transparent`
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <Flag className={`w-3.5 h-3.5 ${active ? m.textClass : ""}`} />
                      {T(m.label, m.labelEn)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Folder */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-16 shrink-0">{T("فولدر", "Folder")}</span>
              <Select value={finalFolderId || "inbox"} onValueChange={(v) => applyFolder(v === "inbox" ? null : v)}>
                <SelectTrigger className="flex-1 rounded-lg">
                  <div className="flex items-center gap-2 truncate">
                    <FolderIcon className="w-4 h-4" style={{ color: selectedFolder?.color || undefined }} />
                    <SelectValue placeholder={T("انتخاب فولدر", "Select folder")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbox">{T("بدون فولدر (Inbox)", "No folder (Inbox)")}</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: f.color || "#888" }} />
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground ltr">⌘N • Enter = {T("ثبت", "save")}</span>
          <Button onClick={submit} disabled={busy || !finalTitle} size="sm" className="gap-1 px-4">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {T("ثبت", "Save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
