import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "@/lib/voiceInput";

type VoiceLang = "fa-IR" | "en-US";
const LS_KEY = "voice_input_lang";

function loadVoiceLang(fallback: VoiceLang): VoiceLang {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "fa-IR" || v === "en-US") return v;
  } catch { /* ignore */ }
  return fallback;
}

type VoiceInputButtonProps = {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  continuous?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  size?: "icon" | "sm" | "default";
  /** hide the FA/EN language switch chip */
  hideLangToggle?: boolean;
};

export function VoiceInputButton({
  onTranscript,
  onInterim,
  continuous = false,
  disabled = false,
  className = "",
  title,
  size = "icon",
  hideLangToggle = false,
}: VoiceInputButtonProps) {
  const { i18n, t } = useTranslation();
  const [listening, setListening] = useState(false);
  const voiceRef = useRef<VoiceInput | null>(null);
  const callbacksRef = useRef({ onTranscript, onInterim });

  // Default to Persian; the app is primarily Persian and browsers default to en-US otherwise.
  const [lang, setLang] = useState<VoiceLang>(() =>
    loadVoiceLang((i18n.language || "fa").startsWith("en") ? "en-US" : "fa-IR"),
  );

  useEffect(() => {
    callbacksRef.current = { onTranscript, onInterim };
  }, [onTranscript, onInterim]);

  useEffect(() => {
    const voice = new VoiceInput({
      onTranscript: (text) => callbacksRef.current.onTranscript(text),
      onInterim: (text) => callbacksRef.current.onInterim?.(text),
      onError: (error) => {
        console.warn("Voice input error:", error);
      },
      onListeningChange: (isListening) => setListening(isListening),
      continuous,
    });
    voiceRef.current = voice;
    return () => {
      voice.stop();
    };
  }, [continuous]);

  const handleClick = () => {
    voiceRef.current?.toggle(lang);
  };

  const switchLang = () => {
    const next: VoiceLang = lang === "fa-IR" ? "en-US" : "fa-IR";
    setLang(next);
    try { localStorage.setItem(LS_KEY, next); } catch { /* ignore */ }
    // restart with the new language if currently recording
    if (listening) {
      voiceRef.current?.stop();
      setTimeout(() => voiceRef.current?.start(next), 250);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Button
        type="button"
        size={size}
        variant={listening ? "default" : "ghost"}
        disabled={disabled}
        onClick={handleClick}
        onMouseDown={(e) => e.preventDefault()}
        title={title || (listening ? t("توقف ضبط", "Stop recording") : t("ضبط صوتی", "Voice input"))}
        className={className}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>
      {!hideLangToggle && (
        <button
          type="button"
          onClick={switchLang}
          onMouseDown={(e) => e.preventDefault()}
          disabled={disabled}
          title={lang === "fa-IR" ? "زبان تشخیص: فارسی (برای تغییر بزنید)" : "Recognition language: English (tap to switch)"}
          className="h-5 px-1.5 rounded-full border text-[10px] font-medium leading-none text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {lang === "fa-IR" ? "FA" : "EN"}
        </button>
      )}
    </span>
  );
}
