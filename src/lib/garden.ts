import { toast } from "sonner";

export type PlantType = "rose" | "bonsai" | "orchid" | "lotus" | "palm" | "bamboo";

export type PlantStage = 1 | 2 | 3 | 4 | 5; // 1: Seed, 2: Sprout, 3: Sapling, 4: Bud, 5: Full Bloom

export interface PlantMetadata {
  id: PlantType;
  name: string;
  latinName: string;
  description: string;
  affinity: string; // e.g. "تسک‌های مهم", "تمرکز", "عادات"
  color: string;
  glowColor: string;
  pointsToBloom: number;
  badge: string;
}

export interface ActivePlant {
  id: string;
  type: PlantType;
  name: string;
  plantedAt: string;
  currentPoints: number;
  stage: PlantStage;
  bloomedAt?: string;
  waterLogCount: number;
  contributions: { reason: string; points: number; date: string }[];
}

export interface GardenHerbariumItem {
  id: string;
  type: PlantType;
  name: string;
  plantedAt: string;
  bloomedAt: string;
  totalPoints: number;
  contributionsCount: number;
}

export interface GardenState {
  waterDrops: number;
  sunEnergy: number;
  totalHarvests: number;
  activePlant: ActivePlant | null;
  herbarium: GardenHerbariumItem[];
  gardenLevel: number;
  soundEnabled: boolean;
}

export const PLANT_SPECIES: Record<PlantType, PlantMetadata> = {
  rose: {
    id: "rose",
    name: "گل سرخ عشق",
    latinName: "Rosa Arshnazia",
    description: "نماد عشق جاودان، انگیزه پرشور و تعهد به هدف‌های قلبی.",
    affinity: "تسک‌های مهم و اولویت بالا",
    color: "#f43f5e",
    glowColor: "rgba(244, 63, 94, 0.4)",
    pointsToBloom: 100,
    badge: "🌹",
  },
  bonsai: {
    id: "bonsai",
    name: "بنسای خرد و استراتژی",
    latinName: "Bonsai Sapientia",
    description: "نماد صبوری، عمق اندیشه، مدیریت منظم و رشد پیوسته.",
    affinity: "یادداشت‌ها، مدل ABC و ثبت افکار CBT",
    color: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.4)",
    pointsToBloom: 120,
    badge: "🪴",
  },
  orchid: {
    id: "orchid",
    name: "ارکیده تمرکز",
    latinName: "Orchis Focus",
    description: "گیاهی شکوهمند که فقط با جلسات عمیق تمرکز و حضور در لحظه رشد می‌کند.",
    affinity: "جلسات پومودورو و زمان کار عمیق",
    color: "#d946ef",
    glowColor: "rgba(217, 70, 239, 0.4)",
    pointsToBloom: 90,
    badge: "🌸",
  },
  lotus: {
    id: "lotus",
    name: "نیلوفر ذهن‌آرام",
    latinName: "Nelumbo Serenitas",
    description: "نماد رهایی از استرس، آرامش درونی و شفافیت ذهن.",
    affinity: "چک‌این روزانه و تمرین تنفس ۳بعدی",
    color: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.4)",
    pointsToBloom: 80,
    badge: "🪷",
  },
  palm: {
    id: "palm",
    name: "نخل استقامت",
    latinName: "Phoenix Constantia",
    description: "استوار در برابر طوفان‌ها، نماد پایداری و حفظ زنجیره عادات.",
    affinity: "زنجیره عادات روزانه (Streaks)",
    color: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.4)",
    pointsToBloom: 110,
    badge: "🌴",
  },
  bamboo: {
    id: "bamboo",
    name: "بامبوی شکوفایی سریع",
    latinName: "Bambusoideae Vita",
    description: "انعطاف‌پذیر و سریع‌الرشد؛ یادآور اینکه هر تسک کوچک گامی بزرگ است.",
    affinity: "تکمیل تسک‌های روزمره",
    color: "#84cc16",
    glowColor: "rgba(132, 204, 22, 0.4)",
    pointsToBloom: 75,
    badge: "🎋",
  },
};

const GARDEN_STORAGE_KEY = "arshnaz_mind_garden_v1";

const DEFAULT_STATE: GardenState = {
  waterDrops: 30,
  sunEnergy: 10,
  totalHarvests: 0,
  gardenLevel: 1,
  soundEnabled: true,
  herbarium: [],
  activePlant: {
    id: "plant-default-1",
    type: "rose",
    name: "گل سرخ عشق",
    plantedAt: new Date().toISOString(),
    currentPoints: 20,
    stage: 2,
    waterLogCount: 2,
    contributions: [
      { reason: "خوش‌آمدگویی به گلخانه", points: 20, date: new Date().toISOString() },
    ],
  },
};

export function getGardenState(): GardenState {
  try {
    const raw = localStorage.getItem(GARDEN_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveGardenState(state: GardenState) {
  try {
    localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("arshnaz-garden-updated", { detail: state }));
  } catch (e) {
    console.error("Failed to save garden state:", e);
  }
}

export function awardWaterDrops(amount: number, reason: string): number {
  const current = getGardenState();
  const newDrops = current.waterDrops + amount;
  const newSun = current.sunEnergy + Math.ceil(amount / 2);
  
  const updated: GardenState = {
    ...current,
    waterDrops: newDrops,
    sunEnergy: newSun,
  };

  saveGardenState(updated);
  
  toast.success(`+${amount} قطره آب برای گلخانه 🌱`, {
    description: reason,
    duration: 3500,
  });

  return newDrops;
}

export function waterActivePlant(amount = 15): { success: boolean; stageUp: boolean; bloomed: boolean } {
  const current = getGardenState();
  if (!current.activePlant) {
    toast.error("هنوز گیاهی در گلدان کاشته نشده است!");
    return { success: false, stageUp: false, bloomed: false };
  }

  if (current.waterDrops < amount) {
    toast.error("قطرات آب کافی نیست!", {
      description: "با تکمیل تسک‌ها و عادات، قطره آب جدید جمع‌آوری کن.",
    });
    return { success: false, stageUp: false, bloomed: false };
  }

  const plantMeta = PLANT_SPECIES[current.activePlant.type];
  const prevStage = current.activePlant.stage;
  const newPoints = current.activePlant.currentPoints + amount;
  const maxPoints = plantMeta.pointsToBloom;

  // Calculate new stage (1 to 5)
  let newStage: PlantStage = 1;
  const ratio = newPoints / maxPoints;
  if (ratio >= 1) newStage = 5;
  else if (ratio >= 0.75) newStage = 4;
  else if (ratio >= 0.45) newStage = 3;
  else if (ratio >= 0.15) newStage = 2;
  else newStage = 1;

  const isBloomed = newStage === 5 && prevStage < 5;
  const isStageUp = newStage > prevStage;

  const updatedPlant: ActivePlant = {
    ...current.activePlant,
    currentPoints: Math.min(newPoints, maxPoints),
    stage: newStage,
    waterLogCount: current.activePlant.waterLogCount + 1,
    bloomedAt: isBloomed ? new Date().toISOString() : current.activePlant.bloomedAt,
    contributions: [
      { reason: "آبیاری و مهر", points: amount, date: new Date().toISOString() },
      ...current.activePlant.contributions.slice(0, 19),
    ],
  };

  const newHerbarium = [...current.herbarium];
  let newHarvests = current.totalHarvests;
  let newLevel = current.gardenLevel;

  if (isBloomed) {
    newHarvests += 1;
    newLevel = Math.floor(newHarvests / 2) + 1;
    newHerbarium.unshift({
      id: updatedPlant.id,
      type: updatedPlant.type,
      name: updatedPlant.name,
      plantedAt: updatedPlant.plantedAt,
      bloomedAt: new Date().toISOString(),
      totalPoints: updatedPlant.currentPoints,
      contributionsCount: updatedPlant.contributions.length,
    });
  }

  const nextState: GardenState = {
    ...current,
    waterDrops: current.waterDrops - amount,
    totalHarvests: newHarvests,
    gardenLevel: newLevel,
    activePlant: updatedPlant,
    herbarium: newHerbarium,
  };

  saveGardenState(nextState);
  return { success: true, stageUp: isStageUp, bloomed: isBloomed };
}

export function plantNewSeed(type: PlantType): ActivePlant {
  const current = getGardenState();
  const meta = PLANT_SPECIES[type];

  const newPlant: ActivePlant = {
    id: `plant-${Date.now()}`,
    type,
    name: meta.name,
    plantedAt: new Date().toISOString(),
    currentPoints: 0,
    stage: 1,
    waterLogCount: 0,
    contributions: [
      { reason: "کاشت بذر جدید", points: 0, date: new Date().toISOString() },
    ],
  };

  const nextState: GardenState = {
    ...current,
    activePlant: newPlant,
  };

  saveGardenState(nextState);
  toast.success(`بذر «${meta.name}» با موفقیت در خاک کاشته شد 🌱`);
  return newPlant;
}
