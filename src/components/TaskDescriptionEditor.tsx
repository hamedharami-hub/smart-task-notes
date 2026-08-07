import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Maximize2, Check, Eraser } from "lucide-react";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NoteEditorTabs } from "@/components/NoteEditorTabs";
import { VoiceInputButton } from "@/components/VoiceInputButton";

/**
 * Task description editor with markdown support.
 * - Inline: AutoTextarea while editing; renders markdown preview when blurred (if content).
 * - Fullscreen button opens a Sheet with the full NoteEditorTabs (visual/markdown/preview).
 */
export function TaskDescriptionEditor({
  taskId,
  value,
  onChange,
  onSave,
  readOnly = false,
}: {
  taskId: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  readOnly?: boolean;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [editing, setEditing] = useState(false);
  const [full, setFull] = useState(false);
  const [draft, setDraft] = useState(value);

  const hasContent = (value || "").trim().length > 0;

  return (
    <div className="relative group">
      {editing || !hasContent ? (
        <AutoTextarea
          placeholder={T("توضیحات…", "Description…")}
          value={value || ""}
          disabled={readOnly}
          onFocus={() => !readOnly && setEditing(true)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { setEditing(false); onSave(value || ""); }}
          minHeight={32}
          maxHeight={360}
          dir="auto"
          className={`border-none bg-transparent focus-visible:ring-0 px-0 text-[14px] text-foreground/90 placeholder:text-muted-foreground/70 ${hasContent ? "pe-[5.5rem]" : "pe-14"}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => !readOnly && setEditing(true)}
          disabled={readOnly}
          dir="auto"
          className={`w-full text-start px-0 py-1 text-[14px] text-foreground/90 rounded transition ${readOnly ? "pe-14" : "pe-[5.5rem] hover:bg-accent/30"}`}
        >
          <div className="prose-note prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        </button>
      )}

      {!readOnly && (
        <>
          {hasContent && (
            <button
              type="button"
              onClick={() => { onChange(""); onSave(""); setDraft(""); setEditing(true); }}
              aria-label={T("پاک کردن متن", "Clear text")}
              title={T("پاک کردن کامل متن", "Clear all text")}
              className="absolute top-1 end-[3.25rem] p-1 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-accent/50 transition opacity-70 group-hover:opacity-100"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          )}
          <VoiceInputButton
            continuous
            onTranscript={(text) => {
              const next = (value || "").trimEnd() + " " + text;
              onChange(next);
              onSave(next);
            }}
            size="sm"
            className="absolute top-1 end-7 h-7 w-7 text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 opacity-70 group-hover:opacity-100"
            title={T("ضبط صوتی", "Voice input")}
          />
          <button
            type="button"
            onClick={() => { setDraft(value || ""); setFull(true); }}
            aria-label={T("تمام صفحه", "Fullscreen")}
            className="absolute top-1 end-0 p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition opacity-70 group-hover:opacity-100"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      <Sheet open={full} onOpenChange={setFull}>
        <SheetContent side="bottom" className="h-[95vh] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base">{T("توضیحات تسک", "Task description")}</SheetTitle>
            <Button
              size="sm"
              onClick={() => { onChange(draft); onSave(draft); setFull(false); }}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              {T("ذخیره", "Save")}
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <NoteEditorTabs
              noteId={`task-desc-${taskId}`}
              markdown={draft}
              onChange={(md) => setDraft(md)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
