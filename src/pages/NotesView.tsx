import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Pin, Trash2, Search, Sparkles, Loader2, FolderInput, PinOff, Share2, X, Maximize2 } from "lucide-react";
import ShareDialog from "@/components/ShareDialog";
import SwipeableRow from "@/components/gestures/SwipeableRow";
import { MoveToDialog } from "@/components/MoveToDialog";
import { startItemDrag } from "@/lib/dragToFolder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { NoteEditorTabs } from "@/components/NoteEditorTabs";
import { markdownToHtml } from "@/lib/markdown";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { BidiText } from "@/components/BidiText";
import { callAI, getAILanguage, type AILanguage } from "@/lib/ai";
import { AILangToggle } from "@/components/AILangToggle";
import { pushUndo } from "@/lib/undoStack";
import { pushDeleted } from "@/lib/recentlyDeleted";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useShareAccess } from "@/hooks/useShareAccess";



type Note = { id: string; user_id?: string; title: string; content: string; pinned: boolean; updated_at: string; task_id?: string | null; folder_id?: string | null };

export default function NotesView() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const aiGroups = useMemo(() => [
    {
      label: T("بهبود نگارش", "Improve writing"),
      items: [
        { key: "improve", label: T("✨ بهبود کلی نگارش", "✨ General improvement") },
        { key: "fix_grammar", label: T("✏️ اصلاح املا و گرامر", "✏️ Fix spelling & grammar") },
        { key: "make_concise", label: T("🎯 موجز و فشرده‌تر", "🎯 Make concise") },
      ],
    },
    {
      label: T("ساختار و فرمت", "Structure & format"),
      items: [
        { key: "auto_format", label: T("🪄 فرمت‌بندی هوشمند (سرتیتر، Bold، لیست)", "🪄 Auto format (headings, bold, lists)") },
        { key: "add_headings", label: T("📑 اضافه کردن سرتیتر مناسب", "📑 Add proper headings") },
        { key: "bold_keywords", label: T("🅱️ Bold کردن نکات کلیدی", "🅱️ Bold key points") },
        { key: "to_list", label: T("• تبدیل به لیست", "• Convert to list") },
        { key: "to_outline", label: T("🗂 ساختار Outline", "🗂 Outline structure") },
      ],
    },
    {
      label: T("خلاصه و گسترش", "Summarize & expand"),
      items: [
        { key: "summarize", label: T("📝 خلاصه کن", "📝 Summarize") },
        { key: "expand", label: T("📖 گسترش بده", "📖 Expand") },
        { key: "continue_writing", label: T("✍️ ادامه‌ی متن را بنویس", "✍️ Continue writing") },
        { key: "tldr", label: T("⚡ TL;DR در ۳ خط", "⚡ TL;DR in 3 lines") },
      ],
    },
    {
      label: T("سبک و لحن", "Tone & style"),
      items: [
        { key: "tone_formal", label: T("👔 رسمی و حرفه‌ای", "👔 Formal & professional") },
        { key: "tone_casual", label: T("😊 صمیمی و دوستانه", "😊 Casual & friendly") },
        { key: "tone_academic", label: T("🎓 آکادمیک", "🎓 Academic") },
        { key: "tone_motivational", label: T("🔥 انگیزشی", "🔥 Motivational") },
        { key: "simplify", label: T("🧒 ساده برای همه‌فهم", "🧒 Simplify") },
      ],
    },
    {
      label: T("ترجمه", "Translate"),
      items: [
        { key: "translate_fa", label: T("🇮🇷 ترجمه به فارسی", "🇮🇷 Translate to Persian") },
        { key: "translate_en", label: T("🇬🇧 ترجمه به انگلیسی", "🇬🇧 Translate to English") },
      ],
    },
  ], [isEn, T]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [snap, setSnap] = useState<number | string>(0.55);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<{ html: string; md: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Note | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLang, setAiLang] = useState<AILanguage>(getAILanguage());
  const [moveOpen, setMoveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { canEdit, isOwner } = useShareAccess("note", selected?.id, selected?.user_id);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notes").select("*")
      .is("task_id", null)
      .order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setNotes(((data || []) as unknown) as Note[]);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    const ch = supabase.channel("notes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const preselectId = searchParams.get("select");
  useEffect(() => {
    if (!preselectId || notes.length === 0) return;
    const found = notes.find(n => n.id === preselectId);
    if (found) {
      setSelected(found);
      setDraft({ html: markdownToHtml(found.content || ""), md: found.content || "" });
    }
    setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId, notes]);

  const create = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("notes").insert({
      user_id: user.id, title: T("نوت جدید", "New note"), content: "",
    }).select().single();
    if (error) toast.error(error.message);
    else if (data) {
      const note = data as Note;
      setNotes(prev => [note, ...prev]);
      setSelected(note);
      setDraft({ html: "", md: "" });
    }
  };

  const save = async (patch: Partial<Note>) => {
    if (!selected) return;
    if (!canEdit) { toast(T("دسترسی ویرایش ندارید", "You don't have edit permission")); return; }
    const updated = { ...selected, ...patch };
    setSelected(updated);
    await supabase.from("notes").update(patch).eq("id", selected.id);
  };

  useEffect(() => {
    if (!draft || !selected) return;
    const t = setTimeout(() => { save({ content: draft.md }); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [draft?.md]);

  const del = async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note && note.user_id !== user?.id) { toast(T("فقط صاحب نوت می‌تواند حذف کند", "Only the note owner can delete")); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from("notes").delete().eq("id", id);
    if (selected?.id === id) { setSelected(null); setDraft(null); }
    if (note) {
      const restore = async () => {
        await supabase.from("notes").insert(note as any);
        load();
      };
      pushUndo({ label: T(`نوت «${note.title || T("بدون عنوان", "Untitled")}» حذف شد`, `Note "${note.title || T("بدون عنوان", "Untitled")}" deleted`), undo: restore });
      pushDeleted({ kind: "note", label: note.title || T("بدون عنوان", "Untitled"), restore });
    }
  };

  const runNoteAI = async (action: string) => {
    if (!selected) return;
    if (!canEdit) { toast(T("دسترسی ویرایش ندارید", "You don't have edit permission")); return; }
    const md = (draft?.md ?? selected.content ?? "").trim();
    if (!md) return toast.error(T("نوت خالی است", "Note is empty"));
    setAiBusy(true);
    try {
      const r = await callAI("inline_edit", md, undefined, action, aiLang);
      const newMd = (r.text || "").trim();
      if (!newMd) throw new Error(T("نتیجه خالی", "Empty result"));
      setDraft({ md: newMd, html: markdownToHtml(newMd) });
      await save({ content: newMd });
      toast.success(T("اعمال شد ✨", "Applied ✨"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setAiBusy(false);
    }
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  // Plain-preview helper (strip MD chars) for sidebar
  const stripMd = (s: string) => (s || "").replace(/[#*`>_![\]()~-]+/g, "").replace(/\n+/g, " ").slice(0, 80);

  const emptyState = (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      {T("یک نوت انتخاب کن یا جدید بساز", "Select a note or create a new one")}
    </div>
  );

  const editor = selected ? (
    <div className="px-3 sm:px-4 py-2 w-full min-h-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input value={selected.title} onChange={(e) => save({ title: e.target.value })}
          disabled={!canEdit}
          className="text-xl font-bold border-none focus-visible:ring-0 px-0 flex-1 min-w-[120px]" dir="auto" />
        <VoiceInputButton
          onTranscript={(text) => save({ title: selected.title ? selected.title.trimEnd() + " " + text : text })}
          disabled={!canEdit}
          size="icon"
          className="h-9 w-9 shrink-0"
        />
        <AILangToggle value={aiLang} onChange={setAiLang} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" className="gap-1" disabled={aiBusy || !canEdit}>
              {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto w-64">
            {aiGroups.map((g, gi) => (
              <div key={g.label}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">{g.label}</DropdownMenuLabel>
                {g.items.map((it) => (
                  <DropdownMenuItem key={it.key} onClick={() => runNoteAI(it.key)} disabled={!canEdit}>
                    {it.label}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="icon" variant="ghost" onClick={() => save({ pinned: !selected.pinned })} disabled={!canEdit}>
          <Pin className={`w-4 h-4 ${selected.pinned ? "text-primary fill-primary" : ""}`} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setMoveOpen(true)} title={T("انتقال به فولدر", "Move to folder")} disabled={!canEdit}>
          <FolderInput className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setShareOpen(true)} title={T("اشتراک‌گذاری", "Share")} disabled={!isOwner}>
          <Share2 className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setConfirmDel(selected)} disabled={!isOwner}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <NoteEditorTabs
        noteId={selected.id}
        markdown={draft?.md ?? selected.content ?? ""}
        onChange={(md, html) => setDraft({ html, md })}
        readOnly={!canEdit}
      />
    </div>
  ) : null;

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="md:w-80 border-s md:border-s border-e-0 md:border-e flex flex-col bg-card/30">
        <div dir="rtl" className="p-3 border-b space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">{T("نوت‌ها", "Notes")}</h2>
            <Button size="sm" onClick={create}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input placeholder={T("جستجو...", "Search...")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8" dir="auto" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((n) => (
            <SwipeableRow
              key={n.id}
              onComplete={async () => {
                await supabase.from("notes").update({ pinned: !n.pinned }).eq("id", n.id);
                load();
              }}
              onDelete={() => del(n.id)}
              isCompleted={n.pinned}
              rightLabel={T("پین", "Pin")}
              rightLabelAlt={T("حذف پین", "Unpin")}
              RightIcon={n.pinned ? PinOff : Pin}
              rightColor="amber"
            >
              <div
                draggable
                onDragStart={(e) => startItemDrag(e, { kind: "note", id: n.id, title: n.title })}
                className="border-b bg-card"
                title={T("Drag روی فولدر سایدبار برای انتقال", "Drag onto a folder in the sidebar to move")}
              >
                <button onClick={() => { setSelected(n); setDraft({ html: markdownToHtml(n.content || ""), md: n.content || "" }); }}
                  className={`w-full text-end p-3 hover:bg-accent/40 transition cursor-grab active:cursor-grabbing ${selected?.id === n.id ? "bg-accent/60" : ""}`}>
                  <div className="flex items-center gap-1">
                    {n.pinned && <Pin className="w-3 h-3 text-primary" />}
                    <BidiText as="span" text={n.title} className="font-medium text-sm truncate flex-1" />
                  </div>
                  <BidiText as="p" text={stripMd(n.content)} className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap break-words" />
                </button>
              </div>
            </SwipeableRow>
          ))}
          
        </div>
      </div>

      <div className="hidden md:flex flex-1 min-w-0 overflow-y-auto">
        {selected ? editor : emptyState}
      </div>

      {selected && (
        <Drawer open={true} onOpenChange={(v) => !v && setSelected(null)} snapPoints={[0.55, 1]} activeSnapPoint={snap} setActiveSnapPoint={setSnap} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[95vh] flex flex-col" aria-describedby="note-drawer-desc">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{selected.title}</DrawerTitle>
            </DrawerHeader>
            <div className="flex items-center justify-end px-3 pt-3 pb-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSnap(1)} title={T("فول اسکرین", "Full screen")}>
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(null)} title={T("بستن", "Close")}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4">
              {editor}
            </div>
            <p id="note-drawer-desc" className="sr-only">{T("جزئیات و ویرایش نوت", "Note details and editor")}</p>
          </DrawerContent>
        </Drawer>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("حذف نوت؟", "Delete note?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {T(`آیا مطمئنی می‌خوای «${confirmDel?.title || T("این مورد", "this item")}» را حذف کنی؟ این عمل قابل بازگشت نیست.`, `Are you sure you want to delete "${confirmDel?.title || T("این مورد", "this item")}"? This action cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T("انصراف", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (confirmDel) await del(confirmDel.id); setConfirmDel(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {T("حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selected && (
        <>
          <MoveToDialog
            open={moveOpen}
            onOpenChange={setMoveOpen}
            kind="note"
            itemId={selected.id}
            currentFolderId={selected.folder_id ?? null}
            onMoved={(fid) => { setSelected((prev) => prev ? { ...prev, folder_id: fid } : null); load(); }}
          />
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            resourceType="note"
            resourceId={selected.id}
            resourceTitle={selected.title}
          />
        </>
      )}
    </div>
  );
}
