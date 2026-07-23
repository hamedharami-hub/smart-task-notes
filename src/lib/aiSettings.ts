// Per-operation AI settings
// Each AI operation can have its own provider+model.
// Stored in localStorage. Sent to edge function on every call.

export type Provider = "lovable" | "openai" | "anthropic" | "gemini" | "groq" | "openrouter" | "custom";

export type ProviderConfig = {
  provider: Provider;
  apiKey: string;     // ignored for "lovable"
  model: string;
  baseUrl?: string;   // only for "custom"
};

export type AIOperation =
  | "parse_task"
  | "breakdown"
  | "generate_note"
  | "summarize_note"
  | "improve_note"
  | "suggest"
  | "chat"
  | "inline_edit"
  | "task_subtasks"
  | "task_metadata_suggest"
  | "task_chat"
  | "folder_chat"
  | "socratic"
  | "distortion_detect";

export type OperationMeta = {
  key: AIOperation;
  labelFa: string;
  labelEn: string;
  descFa: string;
  descEn: string;
  usedInFa: string;
  usedInEn: string;
  group: string;       // FA group label (used as fallback)
  groupEn: string;
};

export const OPERATIONS: OperationMeta[] = [
  // General
  { key: "chat",                  labelFa: "چت عمومی AI",                     labelEn: "General AI chat",               descFa: "دستیار عمومی برای هر سوالی.",                                descEn: "General-purpose assistant.",                                   usedInFa: "دستیار AI (Sidebar)", usedInEn: "AI assistant (Sidebar)", group: "عمومی", groupEn: "General" },
  { key: "suggest",               labelFa: "پیشنهادهای موضوعی",               labelEn: "Topic suggestions",             descFa: "پیشنهاد چند تسک یا ایده پیرامون یک موضوع.",                  descEn: "Suggests several tasks/ideas around a topic.",                 usedInFa: "دستیار AI → تب پیشنهاد", usedInEn: "AI assistant → Suggest tab", group: "عمومی", groupEn: "General" },
  // Tasks
  { key: "parse_task",            labelFa: "تجزیه زبان طبیعی به تسک",       labelEn: "Natural-language → Task",      descFa: "تبدیل یک جمله به تسک ساختاریافته (عنوان، اولویت، تاریخ).", descEn: "Turn a sentence into a structured task (title, priority, date).", usedInFa: "دستیار AI → تب تسک", usedInEn: "AI assistant → Task tab", group: "تسک", groupEn: "Tasks" },
  { key: "task_metadata_suggest", labelFa: "پیشنهاد priority/due/recurrence", labelEn: "Suggest priority / due / repeat", descFa: "بر اساس عنوان، اولویت و تاریخ مناسب را پیشنهاد می‌دهد.",   descEn: "Suggests priority and due date from the title.",               usedInFa: "جزئیات تسک → AI → پیشنهاد", usedInEn: "Task detail → AI → Suggest", group: "تسک", groupEn: "Tasks" },
  { key: "task_subtasks",         labelFa: "Subtaskهای هوشمند تسک",          labelEn: "Smart subtasks",                descFa: "پیشنهاد ۳-۷ زیرتسک با ترتیب منطقی.",                       descEn: "Suggests 3–7 ordered subtasks.",                               usedInFa: "جزئیات تسک → AI → مراحل", usedInEn: "Task detail → AI → Steps", group: "تسک", groupEn: "Tasks" },
  { key: "task_chat",             labelFa: "چت روی یک تسک",                  labelEn: "Chat on a task",                descFa: "گفتگو درباره یک تسک خاص.",                                  descEn: "Conversation focused on one task.",                            usedInFa: "جزئیات تسک → AI → چت", usedInEn: "Task detail → AI → Chat", group: "تسک", groupEn: "Tasks" },
  { key: "generate_note",         labelFa: "تولید نوت",                       labelEn: "Generate note",                 descFa: "نوشتن یک نوت کامل از روی موضوع.",                           descEn: "Writes a full note from a topic.",                             usedInFa: "دستیار AI / جزئیات تسک → AI → نوت", usedInEn: "AI assistant / Task detail → AI → Note", group: "نوت", groupEn: "Notes" },
  { key: "breakdown",             labelFa: "خرد کردن تسک به subtask",        labelEn: "Break task into subtasks",      descFa: "تسک را به مراحل کوچک‌تر اجرایی تقسیم می‌کند.",            descEn: "Splits a task into smaller actionable steps.",                  usedInFa: "در حال حاضر استفاده نشده", usedInEn: "Not used in current UI", group: "تسک", groupEn: "Tasks" },
  // Notes
  { key: "summarize_note",        labelFa: "خلاصه‌سازی نوت",                  labelEn: "Summarize note",                descFa: "خلاصه کوتاه و واضح از یک نوت بلند.",                         descEn: "Short, clear summary of a long note.",                         usedInFa: "در حال حاضر استفاده نشده", usedInEn: "Not used in current UI", group: "نوت", groupEn: "Notes" },
  { key: "improve_note",          labelFa: "بهبود متن نوت",                   labelEn: "Improve writing",               descFa: "بازنویسی روان‌تر و حرفه‌ای‌تر.",                              descEn: "Smoother, more polished rewrite.",                             usedInFa: "در حال حاضر استفاده نشده", usedInEn: "Not used in current UI", group: "نوت", groupEn: "Notes" },
  { key: "inline_edit",           labelFa: "ویرایش inline متن",               labelEn: "Inline edit",                   descFa: "ویرایش بخش انتخاب‌شده با دستور دلخواه.",                     descEn: "Edit a highlighted span with a custom instruction.",           usedInFa: "نوت‌ها / ویرایشگر → متن انتخابی", usedInEn: "Notes / editor → selected text", group: "نوت", groupEn: "Notes" },
  // Folder
  { key: "folder_chat",           labelFa: "چت روی یک فولدر (پروژه)",        labelEn: "Chat on a folder (project)",    descFa: "گفتگو روی همه تسک‌ها/نوت‌های یک فولدر.",                     descEn: "Chat across a whole folder of tasks/notes.",                   usedInFa: "فولدر → چت AI", usedInEn: "Folder → AI chat", group: "فولدر", groupEn: "Folder" },
  // Mental health
  { key: "socratic",              labelFa: "چت سقراطی (فقط سوال)",            labelEn: "Socratic chat (questions only)", descFa: "فقط سوال می‌پرسد تا خودت به پاسخ برسی.",                    descEn: "Only asks questions, helping you self-discover.",              usedInFa: "ذهن → چت سقراطی (نیاز به اتصال)", usedInEn: "Mind → Socratic (needs wiring)", group: "سلامت ذهن", groupEn: "Mental health" },
  { key: "distortion_detect",     labelFa: "تشخیص خطای شناختی (CBT)",         labelEn: "Cognitive distortion detection (CBT)", descFa: "خطاهای شناختی را در متن پیدا می‌کند.",                descEn: "Finds cognitive distortions in your text.",                    usedInFa: "ذهن → Thought Records", usedInEn: "Mind → Thought Records", group: "سلامت ذهن", groupEn: "Mental health" },
];

// Recommended provider+model for each operation.
// These are *smart defaults* — picked for quality/cost/latency per task type.
// Users can override per-operation in Settings → AI.
export const OP_RECOMMENDED: Record<AIOperation, { provider: Provider; model: string; whyFa: string; whyEn: string }> = {
  parse_task:            { provider: "lovable", model: "google/gemini-3-flash-preview",       whyFa: "سریع و دقیق برای استخراج ساختار",            whyEn: "Fast & accurate at structured extraction" },
  breakdown:             { provider: "lovable", model: "openai/gpt-5-mini",                    whyFa: "استدلال مرحله‌ای بهتر",                       whyEn: "Better step-by-step reasoning" },
  task_subtasks:         { provider: "lovable", model: "openai/gpt-5-mini",                    whyFa: "تقسیم منطقی کار",                              whyEn: "Logical work breakdown" },
  task_metadata_suggest: { provider: "lovable", model: "google/gemini-2.5-flash-lite",         whyFa: "کار سبک، بسیار سریع",                          whyEn: "Lightweight & very fast" },
  task_chat:             { provider: "lovable", model: "google/gemini-3-flash-preview",       whyFa: "متعادل — سریع و خوب",                          whyEn: "Balanced — fast and capable" },
  folder_chat:           { provider: "lovable", model: "google/gemini-2.5-pro",                whyFa: "context طولانی برای پروژه",                    whyEn: "Long context for whole projects" },
  generate_note:         { provider: "lovable", model: "openai/gpt-5",                          whyFa: "کیفیت نوشتاری بالا",                           whyEn: "High writing quality" },
  summarize_note:        { provider: "lovable", model: "google/gemini-2.5-flash",              whyFa: "خلاصه‌سازی سریع و وفادار",                     whyEn: "Fast, faithful summaries" },
  improve_note:          { provider: "lovable", model: "openai/gpt-5-mini",                    whyFa: "بازنویسی طبیعی",                               whyEn: "Natural rewriting" },
  inline_edit:           { provider: "lovable", model: "openai/gpt-5-mini",                    whyFa: "ویرایش دقیق محدوده انتخاب‌شده",                whyEn: "Precise edits on selected text" },
  suggest:               { provider: "lovable", model: "google/gemini-3-flash-preview",       whyFa: "پیشنهاد متنوع و سریع",                         whyEn: "Diverse suggestions, fast" },
  chat:                  { provider: "lovable", model: "openai/gpt-5-mini",                    whyFa: "همه‌کاره و متعادل",                            whyEn: "Versatile & balanced" },
  socratic:              { provider: "lovable", model: "openai/gpt-5",                          whyFa: "سوال‌پرسی عمیق و درست",                        whyEn: "Deep, well-aimed questions" },
  distortion_detect:     { provider: "lovable", model: "openai/gpt-5.2",                        whyFa: "reasoning قوی برای تحلیل CBT",                 whyEn: "Strong reasoning for CBT analysis" },
};

export const PROVIDER_INFO: Record<Provider, { label: string; defaultModel: string; baseUrl: string; help: string; models: string[] }> = {
  lovable: {
    label: "Lovable AI (پیش‌فرض، رایگان)",
    defaultModel: "google/gemini-3-flash-preview",
    baseUrl: "",
    help: "بدون نیاز به کلید — از طریق Lovable Cloud.",
    models: [
      "google/gemini-3.1-pro-preview",
      "google/gemini-3.1-flash-lite-preview",
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview",
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "google/gemini-2.5-flash-image",
      "openai/gpt-5.5",
      "openai/gpt-5.5-pro",
      "openai/gpt-5.4",
      "openai/gpt-5.4-pro",
      "openai/gpt-5.4-mini",
      "openai/gpt-5.4-nano",
      "openai/gpt-5.2",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
    ],
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-5-mini",
    baseUrl: "https://api.openai.com/v1",
    help: "از platform.openai.com کلید بگیرید.",
    models: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-sonnet-latest",
    baseUrl: "https://api.anthropic.com/v1",
    help: "از console.anthropic.com کلید بگیرید.",
    models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  },
  gemini: {
    label: "Google Gemini (مستقیم)",
    defaultModel: "gemini-3.1-flash-preview",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    help: "از aistudio.google.com کلید بگیرید. فقط Gemini 3.1 (Pro · Flash · Flash-Lite · Image).",
    models: [
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-preview",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.1-flash-image-preview",
    ],
  },
  groq: {
    label: "Groq (سریع‌ترین)",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    help: "از console.groq.com کلید بگیرید (رایگان). با دکمه refresh آخرین مدل‌ها از API گرفته می‌شود.",
    models: [
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "moonshotai/kimi-k2-instruct",
      "qwen/qwen3-32b",
      "deepseek-r1-distill-llama-70b",
      "whisper-large-v3-turbo",
    ],
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    baseUrl: "https://openrouter.ai/api/v1",
    help: "از openrouter.ai کلید بگیرید — دسترسی به صدها مدل.",
    models: ["openai/gpt-5", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-pro-1.5", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-r1"],
  },
  custom: { label: "OpenAI-compatible سفارشی", defaultModel: "", baseUrl: "", help: "هر سرویس سازگار با OpenAI API.", models: [] },
};

const SETTINGS_KEY = "ai_settings_v2";
const LEGACY_KEY = "ai_settings_v1";

export type OpStrategy = "recommended" | "global" | "custom";

export type AIPerOpSettings = {
  default: ProviderConfig;
  perOp: Partial<Record<AIOperation, ProviderConfig>>;
  // Legacy: before opStrategies existed this controlled the fallback.
  useRecommended?: boolean;
  // Per-operation strategy: recommended (app default), global (user default), or custom (override).
  opStrategies?: Partial<Record<AIOperation, OpStrategy>>;
  // Model IDs hidden per provider in the model selection dropdowns.
  providerHiddenModels?: Partial<Record<Provider, string[]>>;
};

export function defaultConfig(): ProviderConfig {
  return { provider: "lovable", apiKey: "", model: "google/gemini-3-flash-preview", baseUrl: "" };
}

export function recommendedConfig(op: AIOperation): ProviderConfig {
  const r = OP_RECOMMENDED[op];
  return { provider: r.provider, apiKey: "", model: r.model, baseUrl: "" };
}

// Short description per model — used in Settings UI for guidance.
export const MODEL_DESCRIPTIONS: Record<string, string> = {
  "google/gemini-3.1-pro-preview": "قوی‌ترین Gemini — استدلال عمیق",
  "google/gemini-3-flash-preview": "نسل ۳ — متعادل، سریع و دقیق (پیش‌فرض)",
  "google/gemini-2.5-pro": "قدرتمند برای کارهای پیچیده multimodal",
  "google/gemini-2.5-flash": "سریع و متعادل",
  "google/gemini-2.5-flash-lite": "ارزان‌ترین و سریع‌ترین Gemini 2.5",
  "openai/gpt-5": "قوی‌ترین GPT — دقت بالا",
  "openai/gpt-5-mini": "متعادل GPT-5",
  "openai/gpt-5-nano": "سریع و ارزان GPT-5",
  "openai/gpt-5.2": "جدیدترین GPT با reasoning پیشرفته",
  "llama-3.3-70b-versatile": "قوی‌ترین Llama روی Groq — کیفیت بالا، سرعت سریع",
  "llama-3.1-70b-versatile": "متعادل و همه‌کاره",
  "llama-3.1-8b-instant": "سریع‌ترین — مناسب وظایف ساده و چت سبک",
  "llama-3.2-90b-vision-preview": "پشتیبانی از تصویر + متن",
  "llama-3.2-11b-vision-preview": "تصویر سبک",
  "deepseek-r1-distill-llama-70b": "استدلال زنجیره‌ای عمیق (reasoning)",
  "deepseek-r1-distill-qwen-32b": "استدلال + برنامه‌نویسی",
  "qwen-2.5-32b": "چندزبانه قوی",
  "qwen-2.5-coder-32b": "تخصصی برنامه‌نویسی",
  "mixtral-8x7b-32768": "context طولانی (32k)",
  "gemma2-9b-it": "سبک و سریع از Google",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro — قوی‌ترین",
  "gemini-3.1-flash-preview": "Gemini 3.1 Flash — متعادل",
  "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash-Lite — سریع‌ترین",
  "gemini-3-pro-preview": "Gemini 3 Pro",
  "gemini-3-flash-preview": "Gemini 3 Flash",
  "gemini-3-flash-lite-preview": "Gemini 3 Flash-Lite",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
};

export function loadAISettings(): AIPerOpSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed: AIPerOpSettings = JSON.parse(raw);
      if (typeof parsed.useRecommended !== "boolean") parsed.useRecommended = true;
      if (!parsed.opStrategies) {
        // Migrate from the old boolean override model to explicit strategies.
        const strategies: Partial<Record<AIOperation, OpStrategy>> = {};
        for (const op of OPERATIONS) {
          if (parsed.perOp?.[op.key]) strategies[op.key] = "custom";
          else strategies[op.key] = parsed.useRecommended === false ? "global" : "recommended";
        }
        parsed.opStrategies = strategies;
      }
      if (!parsed.providerHiddenModels) parsed.providerHiddenModels = {};
      return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      const cfg: ProviderConfig = {
        provider: old.provider || "lovable",
        apiKey: old.apiKey || "",
        model: old.model || PROVIDER_INFO[old.provider as Provider]?.defaultModel || "google/gemini-2.5-flash",
        baseUrl: old.baseUrl || "",
      };
      const strategies: Partial<Record<AIOperation, OpStrategy>> = {};
      for (const op of OPERATIONS) strategies[op.key] = "recommended";
      return { default: cfg, perOp: {}, useRecommended: true, opStrategies: strategies, providerHiddenModels: {} };
    }
  } catch {}
  const strategies: Partial<Record<AIOperation, OpStrategy>> = {};
  for (const op of OPERATIONS) strategies[op.key] = "recommended";
  return { default: defaultConfig(), perOp: {}, useRecommended: true, opStrategies: strategies, providerHiddenModels: {} };
}

export function saveAISettings(s: AIPerOpSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function resolveOpStrategy(s: AIPerOpSettings, op: AIOperation): OpStrategy {
  const explicit = s.opStrategies?.[op];
  if (explicit) return explicit;
  if (s.perOp?.[op]) return "custom";
  return s.useRecommended === false ? "global" : "recommended";
}

function resolveRecommendedWithKey(s: AIPerOpSettings, op: AIOperation): ProviderConfig {
  const rec = recommendedConfig(op);
  if (rec.provider === "lovable") return rec;
  if (s.default.provider === rec.provider && s.default.apiKey) {
    return { ...rec, apiKey: s.default.apiKey, baseUrl: s.default.baseUrl };
  }
  return s.default;
}

export function resolveOpConfig(s: AIPerOpSettings, op: AIOperation): ProviderConfig {
  const strategy = resolveOpStrategy(s, op);
  if (strategy === "custom") {
    const override = s.perOp[op];
    if (override) return override;
    // Fallback if a custom strategy exists without a saved config.
    return resolveRecommendedWithKey(s, op);
  }
  if (strategy === "recommended") return resolveRecommendedWithKey(s, op);
  return s.default;
}

/**
 * Resolve which provider+model is used for a given operation.
 * Priority:
 *   1) explicit per-operation custom strategy
 *   2) recommended (if strategy is recommended) — but only if it's a Lovable model
 *      OR the user has a personal key for that provider as the global default
 *   3) global default
 */
export function getOpConfig(op: AIOperation): ProviderConfig {
  return resolveOpConfig(loadAISettings(), op);
}

export function getOpStrategy(op: AIOperation): OpStrategy {
  return resolveOpStrategy(loadAISettings(), op);
}

export function operationLabel(key: AIOperation, lang: "fa" | "en"): string {
  const op = OPERATIONS.find((o) => o.key === key);
  if (!op) return key;
  return lang === "en" ? op.labelEn : op.labelFa;
}
