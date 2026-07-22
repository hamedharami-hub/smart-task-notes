// Pomodoro end-bell sounds (synth via WebAudio so no external assets needed)
// + re-export of ambient sounds for the in-session background.

export type EndBellId = "bell" | "chime" | "digital" | "gong" | "none";

export const END_BELLS: { id: EndBellId; name: string; nameEn: string; emoji: string }[] = [
  { id: "bell",    name: "زنگ کلاسیک",    nameEn: "Classic bell", emoji: "🔔" },
  { id: "chime",   name: "زنگوله ملایم",  nameEn: "Soft chime",   emoji: "🎐" },
  { id: "digital", name: "بیپ دیجیتال",  nameEn: "Digital beep", emoji: "📟" },
  { id: "gong",    name: "گُنگ مدیتیشن", nameEn: "Meditation gong", emoji: "🪘" },
  { id: "none",    name: "بی‌صدا",        nameEn: "Silent",       emoji: "🔇" },
];

let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.25, delay = 0) {
  const c = ctx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playEndBell(id: EndBellId) {
  if (id === "none") return;
  try {
    if (id === "bell") {
      tone(880, 1.4, "sine", 0.35);
      tone(1320, 1.0, "sine", 0.18, 0.05);
    } else if (id === "chime") {
      tone(1046, 0.8, "triangle", 0.25);
      tone(1318, 0.8, "triangle", 0.2, 0.18);
      tone(1568, 1.2, "triangle", 0.2, 0.36);
    } else if (id === "digital") {
      tone(1200, 0.12, "square", 0.22);
      tone(1200, 0.12, "square", 0.22, 0.18);
      tone(1500, 0.18, "square", 0.22, 0.36);
    } else if (id === "gong") {
      tone(196, 2.5, "sine", 0.4);
      tone(294, 2.0, "sine", 0.18, 0.05);
      tone(98, 2.5, "sine", 0.25, 0.02);
    }
  } catch (e) {
    /* ignore */
  }
}
