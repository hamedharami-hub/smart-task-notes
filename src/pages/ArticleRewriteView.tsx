import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { streamAI } from "@/lib/aiStream";
import {
  ArrowRight,
  Loader2,
  Wand2,
  Copy,
  Save,
  ListTodo,
  RotateCw,
  ClipboardPaste,
} from "lucide-react";

const URL_RE = /https?:\/\/[^\s<>"'{}|\\`[\]]+/i;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function ArticleRewriteView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialUrl = params.get("url") || "";
  const initialText = params.get("text") || "";

  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef(content);
  const titleRef = useRef(title);

  const source = useMemo(() => {
    if (url) return url;
    const m = text.match(URL_RE);
    return m ? m[0] : "";
  }, [url, text]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    if (initialUrl && !content) {
      rewrite(initialUrl);
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rewrite = async (fromUrl?: string) => {
    const targetUrl = fromUrl || url || source;
    if (!targetUrl) {
      toast.error("ابتدا یک لینک وارد کنید.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setContent("");
    setTitle("");
    try {
      await streamAI({
        mode: "article_rewrite",
        input: { url: targetUrl, text: text || undefined },
        language: "fa",
        signal: ctrl.signal,
        onDelta: (chunk) => setContent((prev) => prev + chunk),
        onDone: () => {
          const current = contentRef.current;
          const first = current.split("\n").find((l) => l.trim()) || "";
          if (first && !titleRef.current) {
            setTitle(first.replace(/^#+\s*/, "").slice(0, 120));
          }
        },
      });
    } catch (e) {
      if (!isAbortError(e)) toast.error(getErrorMessage(e) || "خطا در بازنویسی");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const paste = async () => {
    try {
      const s = await navigator.clipboard.readText();
      if (!s) return;
      const m = s.match(URL_RE);
      if (m) {
        setUrl(m[0]);
        setText(s.replace(m[0], "").trim());
      } else {
        setText(s);
      }
    } catch {
      toast.error("دسترسی به کلیپ‌بورد داده نشد.");
    }
  };

  const saveNote = async () => {
    if (!user) {
      toast.error("ابتدا وارد شوید.");
      return;
    }
    if (!title.trim()) {
      toast.error("عنوان الزامی است.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: title.trim(),
        content: content.trim(),
      });
      if (error) throw error;
      toast.success("نوت ذخیره شد.");
      navigate("/app/notes");
    } catch (e) {
      toast.error(getErrorMessage(e) || "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  };

  const saveTask = () => {
    const qp = new URLSearchParams();
    qp.set("title", title.trim() || "خبر");
    qp.set("description", content.trim());
    navigate(`/app/new/task?${qp.toString()}`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("کپی شد.");
    } catch {
      toast.error("کپی نشد.");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowRight className="w-4 h-4" /> برگشت
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" /> بازنویسی خبر/مقاله
          </h1>
          <span className="w-12" />
        </div>

        <Card className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">لینک</label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button type="button" size="icon" variant="outline" onClick={paste} title="چسباندن از کلیپ‌بورد">
                <ClipboardPaste className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">متن همراه (اختیاری)</label>
            <Textarea
              placeholder="متن share شده یا توضیحات..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              dir="auto"
              rows={3}
              className="text-sm"
            />
          </div>

          <Button
            onClick={() => rewrite()}
            disabled={!source || loading}
            className="w-full gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? "در حال بازنویسی..." : "بازنویسی کن"}
          </Button>
        </Card>

        {content && (
          <Card className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">عنوان</label>
              <Input
                placeholder="عنوان بازنویسی‌شده"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">متن</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                dir="auto"
                rows={16}
                className="text-sm leading-7"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveNote} disabled={saving || !title.trim()} className="gap-1 flex-1 sm:flex-none">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                ذخیره نوت
              </Button>
              <Button variant="secondary" onClick={saveTask} className="gap-1 flex-1 sm:flex-none">
                <ListTodo className="w-4 h-4" /> تسک
              </Button>
              <Button variant="outline" onClick={copy} className="gap-1 flex-1 sm:flex-none">
                <Copy className="w-4 h-4" /> کپی
              </Button>
              <Button variant="outline" onClick={() => rewrite()} disabled={!source} className="gap-1 flex-1 sm:flex-none">
                <RotateCw className="w-4 h-4" /> دوباره
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
