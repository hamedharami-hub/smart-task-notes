import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code, Image as ImgIcon, Music, Video, Paperclip,
  Link as LinkIcon, Highlighter, AlignLeft, AlignCenter, AlignRight, Minus, Sparkles, Loader2,
  Undo2, Redo2, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { uploadMedia, detectMediaKind } from "@/lib/uploadMedia";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { callAI, getAILanguage } from "@/lib/ai";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import { VoiceInputButton } from "@/components/VoiceInputButton";

const AI_ACTIONS = [
  { key: "improve", label: "✨ بهبود نگارش" },
  { key: "summarize", label: "📝 خلاصه کن" },
  { key: "expand", label: "📖 گسترش بده" },
  { key: "translate_fa", label: "🇮🇷 ترجمه به فارسی" },
  { key: "translate_en", label: "🇬🇧 ترجمه به انگلیسی" },
  { key: "to_list", label: "• تبدیل به لیست" },
  { key: "fix_grammar", label: "✏️ اصلاح املا و گرامر" },
  { key: "tone_formal", label: "👔 لحن رسمی‌تر" },
  { key: "tone_casual", label: "😊 لحن صمیمی‌تر" },
];

export type RichEditorHandle = {
  getHtml: () => string;
  getMarkdown: () => string;
};

export function RichEditor({
  initialHtml = "",
  initialMarkdown = "",
  onChange,
  placeholder = "شروع به نوشتن کنید...",
  readOnly = false,
}: {
  initialHtml?: string;
  initialMarkdown?: string;
  onChange?: (html: string, markdown: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<"image" | "audio" | "video" | "file">("file");
  const [aiBusy, setAiBusy] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [toolbarOnScreen, setToolbarOnScreen] = useState(true);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Youtube.configure({ controls: true, nocookie: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml || (initialMarkdown ? markdownToHtml(initialMarkdown) : ""),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html, htmlToMarkdown(html));
    },
    editorProps: {
      attributes: {
        class: "prose-note focus:outline-none min-h-[50vh] px-1",
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (readOnly) { event.preventDefault(); return true; }
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => insertFile(f));
        return true;
      },
      handlePaste: (_view, event) => {
        if (readOnly) { event.preventDefault(); return true; }
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => insertFile(f));
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const cur = editor.getHTML();
    const next = initialHtml || (initialMarkdown ? markdownToHtml(initialMarkdown) : "");
    if (next && next !== cur && editor.isEmpty) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Detect when toolbar scrolls out of view → show floating "show toolbar" FAB
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setToolbarOnScreen(entry.isIntersecting),
      { rootMargin: "-1px 0px 0px 0px", threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const scrollToToolbar = () => {
    toolbarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const insertFile = async (file: File) => {
    if (!user) return toast.error("ابتدا وارد شوید");
    const kind = detectMediaKind(file);
    const tid = toast.loading(`در حال آپلود ${file.name}...`);
    try {
      const url = await uploadMedia(file, user.id);
      if (!editor) return;
      if (kind === "image") {
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } else if (kind === "video") {
        editor.chain().focus().insertContent(
          `<video controls src="${url}" style="max-width:100%;border-radius:8px;margin:8px 0"></video><p></p>`
        ).run();
      } else if (kind === "audio") {
        editor.chain().focus().insertContent(
          `<audio controls src="${url}" style="width:100%;margin:8px 0"></audio><p></p>`
        ).run();
      } else {
        editor.chain().focus().insertContent(
          `<p>📎 <a href="${url}" target="_blank" rel="noopener">${file.name}</a></p>`
        ).run();
      }
      toast.success("اضافه شد", { id: tid });
    } catch (e: any) {
      toast.error(e.message || "آپلود ناموفق", { id: tid });
    }
  };

  const onPickFile = (kind: "image" | "audio" | "video" | "file") => {
    setPendingKind(kind);
    if (!fileRef.current) return;
    const accept = kind === "image" ? "image/*" : kind === "audio" ? "audio/*" : kind === "video" ? "video/*" : "*/*";
    fileRef.current.accept = accept;
    fileRef.current.value = "";
    fileRef.current.click();
  };

  const addLink = () => {
    const url = prompt("لینک:");
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  const runAI = async (action: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, "\n");
    if (!selected.trim()) return toast.error("ابتدا متن را انتخاب کنید");
    setAiBusy(true);
    try {
      const r = await callAI("inline_edit", selected, undefined, action, getAILanguage());
      const newText = (r.text || "").trim();
      if (!newText) throw new Error("نتیجه خالی");
      editor.chain().focus().deleteRange({ from, to }).insertContent(markdownToHtml(newText)).run();
      toast.success("اعمال شد ✨");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  if (!editor) return <div className="min-h-[50vh] animate-pulse bg-muted/30 rounded" />;

  return (
    <div
      className="bg-background overflow-hidden relative w-full rich-editor-surface"
      data-rich-selection
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none" } as any}
    >
      <input
        ref={fileRef} type="file" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) insertFile(f);
        }}
      />

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Toolbar */}
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-0.5 border-b p-1.5 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo2 className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="w-4 h-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("highlight")} onPressedChange={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter className="w-4 h-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("taskList")} onPressedChange={() => editor.chain().focus().toggleTaskList().run()}>
          <ListChecks className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("codeBlock")} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code className="w-4 h-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Toggle size="sm" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="w-4 h-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="w-4 h-4" />
        </Toggle>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onPickFile("image")} title="تصویر">
          <ImgIcon className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onPickFile("audio")} title="صدا">
          <Music className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onPickFile("video")} title="ویدیو">
          <Video className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onPickFile("file")} title="فایل">
          <Paperclip className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={addLink} title="لینک">
          <LinkIcon className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="خط افقی">
          <Minus className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <VoiceInputButton
          continuous
          onTranscript={(text) => editor?.chain().focus().insertContent(text + " ").run()}
          disabled={!editor || readOnly}
          size="sm"
          className="h-8 px-2"
          title={"ضبط صوتی"}
        />
      </div>

      {/* Bubble menu for AI */}
      <BubbleMenu editor={editor} updateDelay={100}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1 shadow-elegant" disabled={aiBusy}>
              {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AI
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {AI_ACTIONS.map((a) => (
              <DropdownMenuItem key={a.key} onClick={() => runAI(a.key)}>
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </BubbleMenu>

      <div className="px-1 py-2">
        <EditorContent editor={editor} />
      </div>

      {/* Floating "show toolbar" FAB when toolbar is scrolled out */}
      {!toolbarOnScreen && (
        <button
          type="button"
          onClick={scrollToToolbar}
          className="fixed bottom-20 left-4 z-40 h-11 w-11 rounded-full shadow-elegant bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition"
          title="نمایش نوار ابزار"
          aria-label="نمایش نوار ابزار"
        >
          <Wrench className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
