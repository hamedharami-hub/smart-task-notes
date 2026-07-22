import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Calendar as CalendarIcon, CalendarClock, Tag, Folder, Flag, type LucideIcon } from "lucide-react";
import { parseNaturalDate } from "@/lib/nlDate";
import { toPersianDigits } from "@/lib/persianDigits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DueDatePicker } from "@/components/DueDatePicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PRIORITY_META, type Priority } from "@/lib/priority";


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
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const placeholderText = placeholder || T("+ تسک جدید...", "+ New task...");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [due, setDue] = useState<string | null>(defaults.due_date ?? null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("folders").select("id,name").order("name").then(({ data }) => setFolders(data || []));
    supabase.from("tags").select("id,name,color").order("name").then(({ data }) => setTags(data || []));
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

  const submit = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      // Prefer explicit date picker / defaults, otherwise use NLP-detected values.
      const finalDue = due ?? defaults.due_date ?? parsed.dueDate ?? null;
      const finalTitle = parsed.title;
      const tagIds = Array.from(new Set([
        ...(defaults.tag_id ? [defaults.tag_id] : []),
        ...parsed.tagIds,
      ]));
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: finalTitle,
          folder_id: parsed.folderId ?? defaults.folder_id ?? null,
          due_date: finalDue,
          parent_id: defaults.parent_id ?? null,
          priority: parsed.priority ?? "none",
        } as any)
        .select()
        .single();
      if (error) throw error;
      if (data && tagIds.length) {
        await supabase
          .from("task_tags")
          .insert(tagIds.map(tag_id => ({ task_id: data.id, tag_id, user_id: user.id })));
      }
      setTitle("");
      setDue(defaults.due_date ?? null);
      window.dispatchEvent(new Event("tasks-changed"));
      if (data) onCreated?.(data.id);
    } catch (e: any) {
      toast.error(e.message || T("خطا", "Error"));
    } finally {
      setBusy(false);
    }
  };

  const detectedDue = parsed.dueDate && !due && !defaults.due_date;
  const hintItems: { icon: LucideIcon; label: string }[] = [];
  if (detectedDue) {
    hintItems.push({
      icon: CalendarClock,
      label: new Date(parsed.dueDate).toLocaleDateString(isEn ? "en-US" : "fa-IR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    });
  }
  if (parsed.folderId) {
    hintItems.push({ icon: Folder, label: `@${folders.find(f => f.id === parsed.folderId)?.name || ""}` });
  }
  if (parsed.tagIds.length) {
    parsed.tagIds.forEach(id => {
      const tg = tags.find(t => t.id === id);
      if (tg) hintItems.push({ icon: Tag, label: `#${tg.name}` });
    });
  }
  if (parsed.priority && parsed.priority !== "none") {
    const pMeta = PRIORITY_META[parsed.priority];
    hintItems.push({ icon: Flag, label: `!${T(pMeta.label, pMeta.labelEn)}` });
  }

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
    </div>
  );
}
