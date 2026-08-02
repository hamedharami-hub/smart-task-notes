import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowRight, Loader2, FolderInput, Pin } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/RichEditor";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { useTranslation } from "react-i18next";

type Folder = { id: string; name: string };

export default function NewNoteView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");

  const [title, setTitle] = useState(params.get("title") || "");
  const [content, setContent] = useState(params.get("content") || "");
  const [folderId, setFolderId] = useState<string | null>(params.get("folder_id"));
  const [pinned, setPinned] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("folders").select("id,name").order("position")
      .then(({ data }) => setFolders((data || []) as any));
  }, [user]);

  const submit = async () => {
    if (!user || !title.trim()) {
      toast.error("عنوان الزامی است");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: title.trim(),
        content,
        folder_id: folderId,
        pinned,
      });
      if (error) throw error;
      toast.success("نوت ساخته شد");
      navigate("/app/notes");
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ArrowRight className="w-4 h-4" /> برگشت
        </Button>
        <h1 className="text-lg font-bold">نوت جدید</h1>
        <Button onClick={submit} disabled={busy || !title.trim()} size="sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="عنوان نوت..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            dir="auto"
            className="text-lg font-semibold flex-1"
          />
          <VoiceInputButton
            onTranscript={(text) => setTitle((prev) => (prev ? prev.trimEnd() + " " + text : text))}
            size="icon"
            className="h-10 w-10 shrink-0"
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <FolderInput className="w-3 h-3" /> فولدر
            </label>
            <select
              value={folderId || ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">📥 بدون فولدر</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>📁 {f.name}</option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant={pinned ? "default" : "outline"}
            onClick={() => setPinned(!pinned)}
            className="gap-1"
          >
            <Pin className="w-4 h-4" /> {pinned ? "پین شده" : "پین"}
          </Button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground">محتوا</label>
            <Button
              size="icon"
              variant={voiceListening ? "default" : "ghost"}
              onClick={() => voiceInstance?.toggle(isEn ? "en-US" : "fa-IR")}
              className="h-8 w-8"
              title="ضبط صوتی"
            >
              {voiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          </div>
          <RichEditor initialMarkdown={content} onChange={(_html, md) => setContent(md)} />
        </div>
      </Card>
    </div>
  );
}
