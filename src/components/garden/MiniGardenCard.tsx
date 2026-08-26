import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Droplets, Sparkles, ArrowLeft, Sprout } from "lucide-react";
import {
  getGardenState,
  waterActivePlant,
  PLANT_SPECIES,
  type GardenState,
} from "@/lib/garden";
import PlantCanvas from "./PlantCanvas";

export default function MiniGardenCard() {
  const [garden, setGarden] = useState<GardenState>(getGardenState);
  const [watering, setWatering] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setGarden(e.detail);
      else setGarden(getGardenState());
    };
    window.addEventListener("arshnaz-garden-updated", handler);
    return () => window.removeEventListener("arshnaz-garden-updated", handler);
  }, []);

  const plant = garden.activePlant;
  if (!plant) return null;

  const meta = PLANT_SPECIES[plant.type] || PLANT_SPECIES.rose;
  const progressPct = Math.min(100, Math.round((plant.currentPoints / meta.pointsToBloom) * 100));

  const handleQuickWater = () => {
    setWatering(true);
    waterActivePlant(15);
    setTimeout(() => setWatering(false), 1200);
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-card/80 via-card/50 to-primary/5 border border-border/70 shadow-sm relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div
        className="absolute top-0 end-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: meta.color }}
      />

      <div className="flex items-center justify-between gap-4">
        {/* Right Info Section */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.badge}</span>
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                باغچه رشد: <span className="text-primary">{plant.name}</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                مرحله {plant.stage} از ۵ · {progressPct}٪ تا شکوفایی کامل
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
              <span>{plant.currentPoints} / {meta.pointsToBloom} امتیاز</span>
              <span className="flex items-center gap-1 text-sky-500 font-bold">
                <Droplets className="w-3 h-3" /> {garden.waterDrops} قطره آب
              </span>
            </div>
            <Progress value={progressPct} className="h-2 rounded-full" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleQuickWater}
              disabled={garden.waterDrops < 15 || plant.stage === 5}
              className="h-7 px-3 text-xs bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-full shadow-sm"
            >
              <Droplets className="w-3 h-3 me-1" /> آبیاری (+۱۵)
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs rounded-full border-border/80 text-muted-foreground hover:text-foreground"
            >
              <Link to="/app/garden">
                ورود به گلخانه <ArrowLeft className="w-3 h-3 ms-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Left Interactive Plant Preview */}
        <div className="shrink-0 flex items-center justify-center p-1 bg-background/50 rounded-2xl border shadow-inner">
          <PlantCanvas plant={plant} isWatering={watering} size="sm" />
        </div>
      </div>
    </Card>
  );
}
