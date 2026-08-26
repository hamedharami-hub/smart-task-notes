import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sprout,
  Droplets,
  Sun,
  Trophy,
  Sparkles,
  Plus,
  RefreshCw,
  Award,
  Heart,
  Volume2,
  VolumeX,
  History,
  CheckCircle2,
} from "lucide-react";
import {
  getGardenState,
  saveGardenState,
  waterActivePlant,
  plantNewSeed,
  PLANT_SPECIES,
  type GardenState,
  type PlantType,
} from "@/lib/garden";
import PlantCanvas from "@/components/garden/PlantCanvas";
import PlantPickerModal from "@/components/garden/PlantPickerModal";
import { toast } from "sonner";

// Gentle synthesized zen chime for watering
function playWaterSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Soft high chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.3); // A5
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  } catch {
    /* AudioContext not allowed or unsupported */
  }
}

export default function GardenView() {
  const [garden, setGarden] = useState<GardenState>(getGardenState);
  const [watering, setWatering] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("garden");

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setGarden(e.detail);
      else setGarden(getGardenState());
    };
    window.addEventListener("arshnaz-garden-updated", handler);
    return () => window.removeEventListener("arshnaz-garden-updated", handler);
  }, []);

  const plant = garden.activePlant;
  const meta = plant ? PLANT_SPECIES[plant.type] : PLANT_SPECIES.rose;
  const progressPct = plant
    ? Math.min(100, Math.round((plant.currentPoints / meta.pointsToBloom) * 100))
    : 0;

  const handleWater = (amount = 15) => {
    if (!plant) return;
    setWatering(true);
    if (garden.soundEnabled) playWaterSound();

    const res = waterActivePlant(amount);
    if (res.success) {
      if (res.bloomed) {
        toast.success(`🎉 تبریک! «${plant.name}» به شکوفایی کامل رسید!`, {
          description: "گیاه به کلکسیون افتخارات باغ شما اضافه شد.",
        });
      } else if (res.stageUp) {
        toast.success(`🌱 گیاه وارد مرحله ${plant.stage + 1} رشد شد!`);
      }
    }
    setTimeout(() => setWatering(false), 1000);
  };

  const handleNewSeedSelect = (type: PlantType) => {
    plantNewSeed(type);
  };

  const toggleSound = () => {
    const next = { ...garden, soundEnabled: !garden.soundEnabled };
    saveGardenState(next);
    setGarden(next);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24 animate-fade-in" dir="rtl">
      {/* Top Zen Stats Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-card/80 via-card/50 to-primary/10 border border-border/70 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-2">
              گلخانه و باغ رشد من
              <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary font-bold">
                سطح {garden.gardenLevel}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              هر کار مفید، قطره‌ای برای شکوفایی گل‌های باغ توست.
            </p>
          </div>
        </div>

        {/* Resources & Sound Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-bold font-mono">
            <Droplets className="w-4 h-4 fill-sky-400 text-sky-500" />
            <span>{garden.waterDrops} قطره آب</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{garden.sunEnergy} نور خورشید</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold font-mono">
            <Trophy className="w-4 h-4" />
            <span>{garden.totalHarvests} شکوفایی</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            className="w-8 h-8 rounded-full text-muted-foreground"
            title={garden.soundEnabled ? "صدا فعال است" : "صدا خاموش است"}
          >
            {garden.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 max-w-sm mx-auto h-11 bg-muted/60 p-1 rounded-2xl">
          <TabsTrigger value="garden" className="rounded-xl font-bold text-xs gap-1.5">
            <Sprout className="w-4 h-4" /> گلخانه اصلی
          </TabsTrigger>
          <TabsTrigger value="herbarium" className="rounded-xl font-bold text-xs gap-1.5">
            <Award className="w-4 h-4" /> کلکسیون شکوفه‌ها ({garden.herbarium.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MAIN GREENHOUSE */}
        <TabsContent value="garden" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Stage Glass Sanctuary */}
            <Card className="lg:col-span-8 p-6 md:p-8 rounded-3xl bg-gradient-to-b from-card/90 via-card/60 to-background/80 border border-border/80 shadow-lg relative overflow-hidden flex flex-col items-center">
              {/* Botanical Glow Ring */}
              <div
                className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] opacity-25 pointer-events-none"
                style={{ background: meta.color }}
              />

              {plant ? (
                <>
                  <div className="w-full flex justify-between items-center mb-2 z-10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                      className="text-xs rounded-full gap-1.5 bg-card/60 backdrop-blur"
                    >
                      <RefreshCw className="w-3 h-3" /> تعویض بذر / گلدان
                    </Button>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>مرحله {plant.stage} / ۵</span>
                    </div>
                  </div>

                  {/* Central Animated Plant Canvas */}
                  <div className="py-4 z-10">
                    <PlantCanvas
                      plant={plant}
                      isWatering={watering}
                      onTap={() => handleWater(15)}
                      size="lg"
                    />
                  </div>

                  {/* Growth Progress Bar */}
                  <div className="w-full max-w-md space-y-2 mt-4 z-10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-foreground">میزان رشد تا شکوفایی</span>
                      <span className="font-mono text-muted-foreground font-bold">
                        {plant.currentPoints} / {meta.pointsToBloom} ({progressPct}٪)
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-3 rounded-full bg-muted/80" />
                    
                    {/* Stages labels */}
                    <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                      <span>بذر 🌱</span>
                      <span>جوانه 🌿</span>
                      <span>ساقه 🪴</span>
                      <span>غنچه 🌸</span>
                      <span>شکوفایی 🌺</span>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-3 mt-6 z-10 flex-wrap justify-center">
                    <Button
                      size="lg"
                      onClick={() => handleWater(15)}
                      disabled={garden.waterDrops < 15 || plant.stage === 5}
                      className="px-6 py-6 text-sm font-bold rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/25 transition-transform active:scale-95"
                    >
                      <Droplets className="w-5 h-5 me-2 fill-current" />
                      آبیاری گیاه (-۱۵ قطره)
                    </Button>

                    {plant.stage === 5 ? (
                      <Button
                        size="lg"
                        onClick={() => setPickerOpen(true)}
                        className="px-6 py-6 text-sm font-bold rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25 animate-pulse"
                      >
                        <Sparkles className="w-5 h-5 me-2" />
                        کاشت گل جدید در گلدان
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => handleWater(30)}
                        disabled={garden.waterDrops < 30}
                        className="px-4 py-6 text-xs font-semibold rounded-2xl border-border/80 bg-card/40"
                      >
                        آبیاری عمیق (-۳۰ قطره 💧💧)
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto text-3xl">
                    🌱
                  </div>
                  <h3 className="text-lg font-bold">گلدان شما خالی است!</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    یک بذر جدید انتخاب کنید تا با هر قدم مثبت شاهد رشد و شکوفایی آن باشید.
                  </p>
                  <Button onClick={() => setPickerOpen(true)} className="rounded-2xl gap-2">
                    <Plus className="w-4 h-4" /> انتخاب و کاشت بذر
                  </Button>
                </div>
              )}
            </Card>

            {/* Sidebar Guide & Lore */}
            <div className="lg:col-span-4 space-y-4">
              {/* Active Species Card */}
              {plant && (
                <Card className="p-5 rounded-3xl bg-card/60 border border-border/70 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{meta.badge}</span>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{meta.name}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono">{meta.latinName}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                  <div className="p-3 rounded-2xl bg-primary/5 border border-primary/15 text-xs text-primary font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>همبستگی: {meta.affinity}</span>
                  </div>
                </Card>
              )}

              {/* How to Earn Water Drops */}
              <Card className="p-5 rounded-3xl bg-card/60 border border-border/70 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-sky-500" /> روش‌های دریافت قطره آب
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-xl bg-muted/40">
                    <span>تکمیل هر تسک</span>
                    <span className="font-mono text-sky-500 font-bold">+۱۰ 💧</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-muted/40">
                    <span>انجام عادت روزانه</span>
                    <span className="font-mono text-sky-500 font-bold">+۱۵ 💧</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-muted/40">
                    <span>ثبت Check-in یا افکار CBT</span>
                    <span className="font-mono text-sky-500 font-bold">+۲۰ 💧</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-xl bg-muted/40">
                    <span>جلسه تمرکز Pomodoro</span>
                    <span className="font-mono text-sky-500 font-bold">+۲۵ 💧</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: HERBARIUM / BLOOM ALBUM */}
        <TabsContent value="herbarium" className="space-y-4 mt-0">
          {garden.herbarium.length === 0 ? (
            <Card className="p-12 text-center rounded-3xl bg-card/50 border border-dashed border-border/80">
              <Award className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-bold text-base text-foreground">هنوز گلی به شکوفایی نرسیده است</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                با آبیاری مداوم و انجام کارهای روزانه، اولین گل خود را شکوفا کنید تا در این کلکسیون برای همیشه ثبت شود.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {garden.herbarium.map((item, idx) => {
                const spec = PLANT_SPECIES[item.type] || PLANT_SPECIES.rose;
                return (
                  <Card
                    key={item.id || idx}
                    className="p-5 rounded-3xl bg-card/70 border border-border/80 shadow-sm relative overflow-hidden space-y-3"
                  >
                    <div
                      className="absolute top-0 end-0 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
                      style={{ background: spec.color }}
                    />
                    <div className="flex items-start justify-between">
                      <div className="text-3xl">{spec.badge}</div>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-mono">
                        شکوفا شده ✨
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-base text-foreground">{item.name}</h4>
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        {spec.latinName}
                      </span>
                    </div>

                    <div className="pt-2 border-t text-[11px] text-muted-foreground flex justify-between">
                      <span>انرژی مصرف‌شده:</span>
                      <span className="font-bold text-foreground font-mono">{item.totalPoints} امتیاز</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plant Picker Dialog */}
      <PlantPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleNewSeedSelect}
        currentType={plant?.type}
      />
    </div>
  );
}
