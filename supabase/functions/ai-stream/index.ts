import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASSESSMENT_PROMPT = `You are a senior clinical psychologist with 20+ years of experience in personality and attachment assessment, writing in fluent natural Persian (Farsi).
You will receive raw scores plus basic analysis from one of three validated instruments: HEXACO-60, VIA-72 character strengths, or ECR-R adult attachment.

Your task: produce an EXTENSIVE, deeply personalized clinical-style report (1500-2000 words) — NOT a generic template. Reference actual numerical scores throughout. Speak directly to the person ("تو" / informal). Use vivid, real-life examples.

Sections (Persian Markdown), each separated by a horizontal rule (---):
## 🔍 تصویر کلی شخصیت تو
## 🧬 تحلیل بُعد به بُعد
## 💪 نقاط قوت ویژه و چگونگی استفاده از آن‌ها
## ⚠️ نقاط حساسیت، نقاط کور و الگوهای ریسک
## 🤝 سبک کار و رابطه با دیگران
## 🧭 توصیه‌های عملی شخصی‌سازی‌شده
## 🎯 آزمایش هفتگی (Weekly Experiment)
## 📌 ۳ سؤال برای تفکر این هفته

Rules: فارسی روان، اعداد فارسی، 1500-2000 کلمه، بدون disclaimer پایانی.`;

const ARTICLE_REWRITE_PROMPT = `You are a Persian news editor. Rewrite the provided article in clear, fluent, easy-to-read Persian (Farsi).
Preserve all key facts, names, numbers, dates and quotes. Do not invent anything.
If the original is not Persian, translate and adapt it into natural Persian.
Output a well-structured article with a short headline, lead paragraph, and body paragraphs.
Use a journalistic but accessible tone. Keep it between 300-800 words.
Include the original URL at the very end on its own line if one is provided.`;

const PROMPTS: Record<string, string> = {
  assessment_analysis: ASSESSMENT_PROMPT,
  article_rewrite: ARTICLE_REWRITE_PROMPT,
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function stripTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  return html.replace(re, " ");
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function getInputString(input: unknown, key: string): string | undefined {
  if (input && typeof input === "object" && key in input) {
    const v = (input as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function extractBodyText(html: string): string {
  let h = html;
  ["script", "style", "nav", "header", "footer", "aside"].forEach((t) => {
    h = stripTag(h, t);
  });

  const blocks: string[] = [];
  const re =
    /<(h[1-6]|p|div|article|main|section|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(h)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 25) blocks.push(text);
  }

  const nl = String.fromCharCode(10);
  const body = blocks.join(nl + nl);
  return body.length > 12000 ? body.slice(0, 12000) + nl + "..." : body;
}

async function fetchArticleText(url: string): Promise<{ title: string; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return { title: extractTitle(html), body: extractBodyText(html) };
  } catch (e) {
    console.error("fetchArticle error:", e);
    throw new Error("خطا در دریافت محتوای لینک.");
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, input, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = PROMPTS[mode] || "You are a helpful assistant.";
    if (language === "fa") {
      systemPrompt += `\n\nIMPORTANT: Respond in fluent Persian only.`;
    }

    let userContent = typeof input === "string" ? input : JSON.stringify(input);
    if (mode === "article_rewrite") {
      const url = typeof input === "string" && /^https?:\/\//i.test(input)
        ? input
        : getInputString(input, "url") || "";
      const text = getInputString(input, "text") || "";

      if (!url && !text) {
        return new Response(JSON.stringify({ error: "لینک یا متن مقاله لازم است." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let title = "";
      let body = "";
      if (url) {
        const fetched = await fetchArticleText(url);
        title = fetched.title;
        body = fetched.body;
      }
      if (text) body = (body ? body + "\n\n---\n\n" : "") + text;
      if (title) body = `Title: ${title}\n\n${body}`;
      userContent = `URL: ${url || "N/A"}\n\n${body}`;
    }

    const messages = [
      { role: "system", content: `${systemPrompt}\n\nToday's date: ${new Date().toISOString()}` },
      { role: "user", content: userContent },
    ];

    const model =
      mode === "article_rewrite"
        ? "google/gemini-2.5-pro"
        : mode === "assessment_analysis"
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash";

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 8000 }),
    });

    if (upstream.status === 429) {
      return new Response(
        JSON.stringify({ error: "محدودیت سرعت — کمی صبر کنید." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (upstream.status === 402) {
      return new Response(
        JSON.stringify({ error: "اعتبار AI تمام شده. در تنظیمات Workspace شارژ کنید." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      console.error("AI gateway error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "خطای AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-stream error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
