// Dynamic model discovery per provider.
// Each provider exposes a /models endpoint (OpenAI-compatible).
// Results are cached in localStorage so the user can refresh on demand.

import type { Provider } from "./aiSettings";

const CACHE_KEY = "ai_models_cache_v1";
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

type Cache = Partial<Record<Provider, { ts: number; models: string[] }>>;

function readCache(): Cache {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeCache(c: Cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { }
}

export function getCachedModels(provider: Provider): string[] | null {
  const c = readCache()[provider];
  if (!c) return null;
  if (Date.now() - c.ts > CACHE_TTL) return null;
  return c.models;
}

export function clearModelCache(provider?: Provider) {
  if (!provider) { try { localStorage.removeItem(CACHE_KEY); } catch { } return; }
  const c = readCache(); delete c[provider]; writeCache(c);
}

async function fetchOpenAICompat(url: string, headers: Record<string, string>): Promise<string[]> {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const arr: any[] = j.data || j.models || [];
  return arr.map((m) => m.id || m.name).filter(Boolean);
}

export async function fetchProviderModels(provider: Provider, apiKey: string, baseUrl?: string): Promise<string[]> {
  let models: string[] = [];
  switch (provider) {
    case "openai":
      models = await fetchOpenAICompat("https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` });
      break;
    case "groq":
      models = await fetchOpenAICompat("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${apiKey}` });
      break;
    case "openrouter":
      models = await fetchOpenAICompat("https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${apiKey}` });
      break;
    case "gemini": {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      models = (j.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m: any) => String(m.name || "").replace(/^models\//, ""))
        .filter(Boolean);
      break;
    }
    case "anthropic":
      // Anthropic /models endpoint requires CORS allowance; may fail in browser.
      models = await fetchOpenAICompat("https://api.anthropic.com/v1/models", {
        "x-api-key": apiKey, "anthropic-version": "2023-06-01",
      });
      break;
    case "custom":
      if (!baseUrl) throw new Error("Base URL لازم است");
      models = await fetchOpenAICompat(`${baseUrl.replace(/\/$/, "")}/models`, { Authorization: `Bearer ${apiKey}` });
      break;
    case "lovable":
      // Lovable AI Gateway models are managed centrally — no public listing endpoint.
      throw new Error("Lovable AI: لیست مدل‌ها توسط برنامه به‌روز می‌شود.");
  }
  models = Array.from(new Set(models)).sort();
  const c = readCache();
  c[provider] = { ts: Date.now(), models };
  writeCache(c);
  return models;
}

import { loadAISettings } from "./aiSettings";

// Merge static + cached, dedupe, keep order: cached fresh first, then static fallbacks.
// If `hidden` is not supplied, hidden model IDs saved in AI settings are filtered out.
export function getMergedModels(provider: Provider, staticModels: string[], hidden?: string[]): string[] {
  const hiddenSet = new Set(hidden ?? loadAISettings().providerHiddenModels?.[provider] ?? []);
  const cached = getCachedModels(provider) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...cached, ...staticModels]) {
    if (hiddenSet.has(m) || !seen.has(m)) {
      if (!hiddenSet.has(m)) seen.add(m);
      if (!hiddenSet.has(m)) out.push(m);
    }
  }
  return out;
}

// All known model IDs for a provider, including hidden ones (for the visibility manager).
export function getAllKnownModels(provider: Provider, staticModels: string[]): string[] {
  const cached = getCachedModels(provider) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...cached, ...staticModels]) {
    if (!seen.has(m)) { seen.add(m); out.push(m); }
  }
  return out;
}
