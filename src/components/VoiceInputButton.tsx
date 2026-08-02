import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "@/lib/voiceInput";

type VoiceInputButtonProps = {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  continuous?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  size?: "icon" | "sm" | "default";
};

export function VoiceInputButton({
  onTranscript,
  onInterim,
  continuous = false,
  disabled = false,
  className = "",
  title,
  size = "icon",
}: VoiceInputButtonProps) {
  const { i18n, t } = useTranslation();
  const [listening, setListening] = useState(false);
  const voiceRef = useRef<VoiceInput | null>(null);
  const callbacksRef = useRef({ onTranscript, onInterim });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onInterim };
  }, [onTranscript, onInterim]);

  const lang = (i18n.language || "fa").startsWith("en") ? "en-US" : "fa-IR";

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

  return (
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
  );
}
