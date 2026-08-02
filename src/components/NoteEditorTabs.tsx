import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichEditor } from "@/components/RichEditor";
import { markdownToHtml } from "@/lib/markdown";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Three-mode note editor: visual rich editor / raw markdown / preview.
 * Used by NotesView and inside TaskDetail. Frameless — text spans full width.
 */
export function NoteEditorTabs({
  noteId,
  markdown,
  onChange,
  readOnly = false,
}: {
  noteId: string;
  markdown: string;
  onChange: (md: string, html: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Tabs defaultValue="visual" className="w-full">
      <TabsList>
        <TabsTrigger value="visual">📖 نمایش/ویرایش</TabsTrigger>
        <TabsTrigger value="markdown">📝 Markdown خام</TabsTrigger>
        <TabsTrigger value="preview">👁 پیش‌نمایش</TabsTrigger>
      </TabsList>

      <TabsContent value="visual" className="mt-3">
        <RichEditor
          key={noteId}
          initialMarkdown={markdown}
          onChange={(html, md) => onChange(md, html)}
          readOnly={readOnly}
        />
      </TabsContent>

      <TabsContent value="markdown" className="mt-3 space-y-3">
        <div className="flex items-center justify-end">
          <VoiceInputButton
            continuous
            onTranscript={(text) => {
              const next = (markdown || "").trimEnd() + " " + text;
              onChange(next, markdownToHtml(next));
            }}
            disabled={readOnly}
            size="sm"
            className="h-8 px-2"
          />
        </div>
        <Textarea
          value={markdown}
          onChange={(e) => onChange(e.target.value, markdownToHtml(e.target.value))}
          disabled={readOnly}
          className="min-h-[40vh] font-mono text-sm w-full border-0 focus-visible:ring-0 px-0"
          dir="ltr"
        />
        <div>
          <p className="text-xs text-muted-foreground mb-2">پیش‌نمایش زنده:</p>
          <div className="prose-note max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown || ""}
            </ReactMarkdown>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="preview" className="mt-3">
        <div className="min-h-[50vh]">
          <div className="prose-note max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown || ""}
            </ReactMarkdown>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
