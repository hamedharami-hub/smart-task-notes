// Web Speech API for voice input (tasks and notes)
// Supports Persian (fa-IR) and English (en-US)

/* eslint-disable @typescript-eslint/no-explicit-any */

type VoiceInputOptions = {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (error: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  continuous?: boolean;
};

export class VoiceInput {
  private recognition: any = null;
  private isListening = false;
  private options: VoiceInputOptions;

  constructor(options: VoiceInputOptions) {
    this.options = options;
    this.init();
  }

  private init() {
    if (typeof window === "undefined" || (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window))) {
      this.options.onError?.("Voice input not supported in this browser");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.options.continuous ?? false;
    this.recognition.interimResults = true;
    this.recognition.lang = "fa-IR";

    this.recognition.onstart = () => {
      this.isListening = true;
      this.options.onListeningChange?.(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.options.onListeningChange?.(false);
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.options.onTranscript(finalTranscript);
      }
      if (interimTranscript) {
        this.options.onInterim?.(interimTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      this.options.onListeningChange?.(false);
      const error = event.error;
      if (error === "not-allowed") {
        this.options.onError?.("Microphone permission denied");
      } else if (error === "no-speech") {
        this.options.onError?.("No speech detected");
      } else if (error === "aborted") {
        // User or code stopped; no need to show an error.
      } else {
        this.options.onError?.(`Voice error: ${error}`);
      }
    };
  }

  start(lang: "fa-IR" | "en-US" = "fa-IR") {
    if (!this.recognition) {
      this.options.onError?.("Voice input not supported");
      return;
    }
    if (this.isListening) {
      this.stop();
    }
    this.recognition.lang = lang;
    this.recognition.start();
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  toggle(lang: "fa-IR" | "en-US" = "fa-IR") {
    if (this.isListening) {
      this.stop();
    } else {
      this.start(lang);
    }
  }

  isSupported(): boolean {
    return !!this.recognition;
  }
}
