import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, Sparkles, Check } from "lucide-react";
import { PLANT_SPECIES, type PlantType } from "@/lib/garden";

interface PlantPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: PlantType) => void;
  currentType?: PlantType;
}

export default function PlantPickerModal({
  open,
  onOpenChange,
  onSelect,
  currentType,
}: PlantPickerModalProps) {
  const speciesList = Object.values(PLANT_SPECIES);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sprout className="w-5 h-5 text-emerald-500" /> انتخاب بذر جدید برای کاشت
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            هر بذر بر اساس دسته‌ای از فعالیت‌های شما (تسک، تمرکز، عادات یا آرامش ذهن) بیشترین رشد را تجربه می‌کند.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {speciesList.map((plant) => {
            const isSelected = currentType === plant.id;
            return (
              <Card
                key={plant.id}
                onClick={() => {
                  onSelect(plant.id);
                  onOpenChange(false);
                }}
                className={`p-4 cursor-pointer transition-all hover:scale-[1.02] relative border ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border/70 bg-card/60 hover:bg-accent/40"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 start-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner"
                    style={{ background: plant.glowColor }}
                  >
                    {plant.badge}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      {plant.name}
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-mono block mb-1">
                      {plant.latinName}
                    </span>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                      {plant.description}
                    </p>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/80 text-[10px] text-primary font-medium border">
                      <Sparkles className="w-2.5 h-2.5" /> {plant.affinity}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
