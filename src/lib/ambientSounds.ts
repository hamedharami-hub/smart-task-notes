// Offline ambient + focus music catalog.
// All sounds are generated in real-time via Web Audio API (see pomodoroSynth.ts).
// No downloads, instant playback, keeps playing in background (Media Session + silent <audio>).
export type SoundCategory = "ambient" | "study" | "meditation" | "sleep" | "relax" | "binaural";

export type AmbientSound = {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  category: SoundCategory;
  beta?: boolean;
  hint?: string;
  hintEn?: string;
};

export const AMBIENT_SOUNDS: AmbientSound[] = [
  // Nature ambience
  { id: "rain",   name: "باران",        nameEn: "Rain",        emoji: "🌧️", category: "ambient" },
  { id: "waves",  name: "امواج دریا",   nameEn: "Ocean waves", emoji: "🌊", category: "ambient" },
  { id: "wind",   name: "باد",          nameEn: "Wind",        emoji: "🍃", category: "ambient" },
  { id: "fire",   name: "شومینه",       nameEn: "Fireplace",   emoji: "🔥", category: "ambient" },
  { id: "forest", name: "جنگل",         nameEn: "Forest",      emoji: "🌲", category: "ambient" },
  { id: "cafe",   name: "کافه",         nameEn: "Café",        emoji: "☕", category: "ambient" },

  // Study music (offline synth pads)
  { id: "study_pad", name: "پد مطالعه",  nameEn: "Study pad",  emoji: "📚", category: "study" },
  { id: "dream_pad", name: "رؤیا",       nameEn: "Dream",      emoji: "✨", category: "study" },
  { id: "lofi_pad",  name: "Lo-fi گرم",  nameEn: "Warm Lo-fi", emoji: "🎶", category: "study" },

  // Meditation tracks
  { id: "med_om",       name: "اوم — مدیتیشن", nameEn: "Om — meditation",  emoji: "🕉️", category: "meditation" },
  { id: "med_singing",  name: "کاسه تبتی",     nameEn: "Tibetan bowl",     emoji: "🔔", category: "meditation" },
  { id: "med_drone",    name: "درون آرام",     nameEn: "Calm drone",       emoji: "🪷", category: "meditation" },

  // Sleep
  { id: "sleep_white",   name: "نویز سفید",      nameEn: "White noise",  emoji: "🌫️", category: "sleep" },
  { id: "sleep_brown",   name: "نویز قهوه‌ای",  nameEn: "Brown noise",  emoji: "🛏️", category: "sleep" },
  { id: "sleep_lullaby", name: "لالایی",         nameEn: "Lullaby",      emoji: "🌙", category: "sleep" },

  // Relaxation
  { id: "calm_pad", name: "آرامش", nameEn: "Calm", emoji: "🧘", category: "relax" },

  // Binaural beats — headphones REQUIRED
  { id: "binaural_beta",       name: "Beta — تمرکز عمیق", nameEn: "Beta — deep focus",   emoji: "🎧", category: "binaural", beta: true, hint: "حتماً با هندزفری", hintEn: "Headphones required" },
  { id: "binaural_alpha",      name: "Alpha — تمرکز آرام",  nameEn: "Alpha — calm focus",  emoji: "🎧", category: "binaural", beta: true, hint: "حتماً با هندزفری", hintEn: "Headphones required" },
  { id: "binaural_theta",      name: "Theta — مدیتیشن",     nameEn: "Theta — meditation", emoji: "🎧", category: "binaural", beta: true, hint: "حتماً با هندزفری", hintEn: "Headphones required" },
  { id: "binaural_theta_deep", name: "Theta عمیق — خلسه",   nameEn: "Deep theta — trance", emoji: "🎧", category: "binaural", beta: true, hint: "حتماً با هندزفری", hintEn: "Headphones required" },
  { id: "binaural_delta",      name: "Delta — خواب عمیق",   nameEn: "Delta — deep sleep",  emoji: "🎧", category: "binaural", beta: true, hint: "حتماً با هندزفری", hintEn: "Headphones required" },
];

export const SOUND_CATEGORY_META: Record<SoundCategory, { label: string; labelEn: string; emoji: string }> = {
  ambient:    { label: "محیطی",                labelEn: "Ambient",    emoji: "🌿" },
  study:      { label: "مطالعه",               labelEn: "Study",      emoji: "📚" },
  meditation: { label: "مدیتیشن",              labelEn: "Meditation", emoji: "🪷" },
  sleep:      { label: "خواب",                 labelEn: "Sleep",      emoji: "🌙" },
  relax:      { label: "آرامش",                labelEn: "Relax",      emoji: "🧘" },
  binaural:   { label: "امواج مغزی (هندزفری)", labelEn: "Binaural (headphones)", emoji: "🎧" },
};
