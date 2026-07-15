import { useEffect, useState } from "react";
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
import { BidiText } from "@/components/BidiText";
import { callAI, getAILanguage, type AILanguage } from "@/lib/ai";
import { AILangToggle } from "@/components/AILangToggle";
import { pushUndo } from "@/lib/undoStack";
import { pushDeleted } from "@/lib/recentlyDeleted";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";



type Note = { id: string; title: string; content: string; pinned: boolean; updated_at: string; task_id?: string | null; folder_id?: string | null };

const AI_GROUPS: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: "بهبود نگارش",
    items: [
      { key: "improve", label: "✨ بهبود کلی نگارش" },
      { key: "fix_grammar", label: "✏️ اصلاح املا و گرامر" },
      { key: "make_concise", label: "🎯 موجز و فشرده‌تر" },
    ],
  },
  {
    label: "ساختار و فرمت",
    items: [
      { key: "auto_format", label: "🪄 فرمت‌بندی هوشمند (سرتیتر، Bold، لیست)" },
      { key: "add_headings", label: "📑 اضافه کردن سرتیتر مناسب" },
      { key: "bold_keywords", label: "🅱️ Bold کردن نکات کلیدی" },
      { key: "to_list", label: "• تبدیل به لیست" },
      { key: "to_outline", label: "🗂 ساختار Outline" },
    ],
  },
  {
    label: "خلاصه و گسترش",
    items: [
      { key: "summarize", label: "📝 خلاصه کن" },
      { key: "expand", label: "📖 گسترش بده" },
      { key: "continue_writing", label: "✍️ ادامه‌ی متن را بنویس" },
      { key: "tldr", label: "⚡ TL;DR در ۳ خط" },
    ],
  },
  {
    label: "سبک و لحن",
    items: [
      { key: "tone_formal", label: "👔 رسمی و حرفه‌ای" },
      { key: "tone_casual", label: "😊 صمیمی و دوستانه" },
      { key: "tone_academic", label: "🎓 آکادمیک" },
      { key: "tone_motivational", label: "🔥 انگیزشی" },
      { key: "simplify", label: "🧒 ساده برای همه‌فهم" },
    ],
  },
  {
    label: "ترجمه",
    items: [
      { key: "translate_fa", label: "🇮🇷 ترجمه به فارسی" },
      { key: "translate_en", label: "🇬🇧 ترجمه به انگلیسی" },
    ],
  },
];

export default function NotesView() {
  const { user } = useAuth();
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

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notes").select("*")
      .is("task_id", null)
      .order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setNotes((data || []) as any);
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => {
    const ch = supabase.channel("notes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const create = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("notes").insert({
      user_id: user.id, title: "نوت جدید", content: "",
    }).select().single();
    if (error) toast.error(error.message);
    else if (data) {
      setNotes(prev => [data as any, ...prev]);
      setSelected(data as any);
      setDraft({ html: "", md: "" });
    }
  };

  const save = async (patch: Partial<Note>) => {
    if (!selected) return;
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
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from("notes").delete().eq("id", id);
    if (selected?.id === id) { setSelected(null); setDraft(null); }
    if (note) {
      const restore = async () => {
        await supabase.from("notes").insert(note as any);
        load();
      };
      pushUndo({ label: `نوت «${note.title || "بدون عنوان"}» حذف شد`, undo: restore });
      pushDeleted({ kind: "note", label: note.title || "بدون عنوان", restore });
    }
  };

  const runNoteAI = async (action: string) => {
    if (!selected) return;
    const md = (draft?.md ?? selected.content ?? "").trim();
    if (!md) return toast.error("نوت خالی است");
    setAiBusy(true);
    try {
      const r = await callAI("inline_edit", md, undefined, action, aiLang);
      const newMd = (r.text || "").trim();
      if (!newMd) throw new Error("نتیجه خالی");
      setDraft({ md: newMd, html: markdownToHtml(newMd) });
      await save({ content: newMd });
      toast.success("اعمال شد ✨");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  // Plain-preview helper (strip MD chars) for sidebar
  const stripMd = (s: string) => (s || "").replace(/[#*`>_\-!\[\]()~]+/g, "").replace(/\n+/g, " ").slice(0, 80);

  const emptyState = (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      یک نوت انتخاب کن یا جدید بساز
    </div>
  );

  const editor = selected ? (
    <div className="px-3 sm:px-4 py-2 w-full min-h-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input value={selected.title} onChange={(e) => save({ title: e.target.value })}
          className="text-xl font-bold border-none focus-visible:ring-0 px-0 flex-1 min-w-[120px]" dir="auto" />
        <AILangToggle value={aiLang} onChange={setAiLang} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" className="gap-1" disabled={aiBusy}>
              {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto w-64">
            {AI_GROUPS.map((g, gi) => (
              <div key={g.label}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">{g.label}</DropdownMenuLabel>
                {g.items.map((it) => (
                  <DropdownMenuItem key={it.key} onClick={() => runNoteAI(it.key)}>
                    {it.label}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="icon" variant="ghost" onClick={() => save({ pinned: !selected.pinned })}>
          <Pin className={`w-4 h-4 ${selected.pinned ? "text-primary fill-primary" : ""}`} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setMoveOpen(true)} title="انتقال به فولدر">
          <FolderInput className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setShareOpen(true)} title="اشتراک‌گذاری">
          <Share2 className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setConfirmDel(selected)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <NoteEditorTabs
        noteId={selected.id}
        markdown={draft?.md ?? selected.content ?? ""}
        onChange={(md, html) => setDraft({ html, md })}
      />
    </div>
  ) : null;

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="md:w-80 border-s md:border-s border-e-0 md:border-e flex flex-col bg-card/30">
        <div dir="rtl" className="p-3 border-b space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">نوت‌ها</h2>
            <Button size="sm" onClick={create}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input placeholder="جستجو..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-8" dir="auto" />
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
              rightLabel="Pin"
              rightLabelAlt="Unpin"
              RightIcon={n.pinned ? PinOff : Pin}
              rightColor="amber"
            >
              <div
                draggable
                onDragStart={(e) => startItemDrag(e, { kind: "note", id: n.id, title: n.title })}
                className="border-b bg-card"
                title="Drag روی فولدر سایدبار برای انتقال"
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
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSnap(1)} title="فول اسکرین">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(null)} title="بستن">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4">
              {editor}
            </div>
            <p id="note-drawer-desc" className="sr-only">جزئیات و ویرایش نوت</p>
          </DrawerContent>
        </Drawer>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نوت؟</AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئنی می‌خوای «{confirmDel?.title}» را حذف کنی؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (confirmDel) await del(confirmDel.id); setConfirmDel(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
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
            onMoved={(fid) => { setSelected({ ...selected, folder_id: fid } as any); load(); }}
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
