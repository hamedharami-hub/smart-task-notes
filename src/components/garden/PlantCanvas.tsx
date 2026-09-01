import React, { useState, useEffect } from "react";
import { Sparkles, Droplets, Sun, Moon, Cloud, Flame } from "lucide-react";
import { type ActivePlant, PLANT_SPECIES, type TimeOfDay, getCurrentTimeOfDay } from "@/lib/garden";

interface PlantCanvasProps {
  plant: ActivePlant;
  isWatering?: boolean;
  onTap?: () => void;
  size?: "sm" | "md" | "lg";
  timeOfDay?: TimeOfDay;
  focusBlossoms?: number;
}

export default function PlantCanvas({
  plant,
  isWatering = false,
  onTap,
  size = "lg",
  timeOfDay,
  focusBlossoms = 0,
}: PlantCanvasProps) {
  const meta = PLANT_SPECIES[plant.type] || PLANT_SPECIES.rose;
  const stage = plant.stage;
  const [sway, setSway] = useState(false);
  const effectiveTime = timeOfDay || getCurrentTimeOfDay();

  useEffect(() => {
    const interval = setInterval(() => {
      setSway((prev) => !prev);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const dimensions = {
    sm: { width: 150, height: 175 },
    md: { width: 240, height: 280 },
    lg: { width: 320, height: 380 },
  }[size];

  const potId = "pot-grad-" + plant.id;
  const stemId = "stem-grad-" + plant.id;
  const bloomGlowId = "bloom-glow-" + plant.id;

  // Atmosphere background styles
  const atmosphereStyles: Record<TimeOfDay, { bg: string; border: string; glow: string; text: string }> = {
    morning: {
      bg: "bg-gradient-to-b from-amber-500/20 via-rose-500/10 to-transparent",
      border: "border-amber-500/30",
      glow: "rgba(251, 146, 60, 0.25)",
      text: "صبح زرین 🌅",
    },
    day: {
      bg: "bg-gradient-to-b from-sky-500/20 via-emerald-500/10 to-transparent",
      border: "border-sky-500/30",
      glow: "rgba(56, 189, 248, 0.25)",
      text: "روز پرانرژی ☀️",
    },
    sunset: {
      bg: "bg-gradient-to-b from-orange-600/25 via-purple-600/20 to-transparent",
      border: "border-orange-500/30",
      glow: "rgba(249, 115, 22, 0.3)",
      text: "غروب آرامش 🌇",
    },
    night: {
      bg: "bg-gradient-to-b from-indigo-950/40 via-purple-950/30 to-transparent",
      border: "border-indigo-500/30",
      glow: "rgba(99, 102, 241, 0.3)",
      text: "شب پرستاره 🌙",
    },
  };

  const currentAtmo = atmosphereStyles[effectiveTime];

  return (
    <div
      onClick={onTap}
      className={`relative flex flex-col items-center justify-center select-none rounded-3xl p-3 transition-colors duration-1000 overflow-hidden ${currentAtmo.bg} ${
        onTap ? "cursor-pointer active:scale-95 transition-transform" : ""
      }`}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* 1. ATMOSPHERIC CELESTIAL BACKGROUND & STARS/SUN */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Night Stars */}
        {effectiveTime === "night" && (
          <div className="absolute inset-0">
            <div className="absolute top-4 left-6 w-1 h-1 bg-white rounded-full animate-ping opacity-75" />
            <div className="absolute top-10 right-8 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-pulse opacity-90" />
            <div className="absolute top-16 left-1/3 w-1 h-1 bg-sky-200 rounded-full animate-pulse opacity-60" />
            <div className="absolute top-8 right-1/4 w-1 h-1 bg-white rounded-full animate-ping opacity-80" />
            <div className="absolute top-3 right-6 text-base opacity-80 animate-pulse">🌙</div>
          </div>
        )}

        {/* Morning / Day Sun */}
        {(effectiveTime === "day" || effectiveTime === "morning") && (
          <div className="absolute top-3 right-5 text-xl opacity-90 animate-spin-slow">
            {effectiveTime === "morning" ? "🌅" : "☀️"}
          </div>
        )}

        {/* Sunset Horizon */}
        {effectiveTime === "sunset" && (
          <div className="absolute top-3 right-5 text-xl opacity-90 animate-pulse">
            🌇
          </div>
        )}
      </div>

      {/* 2. LIVING BUTTERFLIES IN DAY/MORNING */}
      {(effectiveTime === "day" || effectiveTime === "morning") && stage >= 2 && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          <div
            className="absolute text-sm animate-bounce opacity-85 transition-all"
            style={{
              top: "22%",
              left: sway ? "22%" : "30%",
              transitionDuration: "2.8s",
            }}
          >
            🦋
          </div>
          {stage >= 4 && (
            <div
              className="absolute text-xs opacity-75 transition-all"
              style={{
                top: "35%",
                right: sway ? "18%" : "26%",
                transitionDuration: "2.5s",
              }}
            >
              🌸
            </div>
          )}
        </div>
      )}

      {/* 3. GLOWING FIREFLIES IN NIGHT/SUNSET */}
      {(effectiveTime === "night" || effectiveTime === "sunset") && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          <div
            className="absolute w-2 h-2 rounded-full bg-amber-300 blur-[1px] animate-ping opacity-80"
            style={{ top: "25%", left: "20%", animationDuration: "2.5s" }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-emerald-300 blur-[1px] animate-pulse opacity-90"
            style={{ top: "40%", right: "22%", animationDuration: "2s" }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-yellow-200 blur-[1px] animate-ping opacity-70"
            style={{ top: "60%", left: "28%", animationDuration: "3s" }}
          />
        </div>
      )}

      {/* 4. ZEN AMBIENT AURA */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-30 transition-all duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${meta.color} 0%, transparent 70%)`,
          transform: `scale(${0.6 + stage * 0.15})`,
        }}
      />

      {/* 5. FOCUS BLOSSOMS BADGE (Pomodoro Achievements) */}
      {focusBlossoms > 0 && (
        <div
          className="absolute top-2 start-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur shadow-xs animate-fade-in"
          title={`${focusBlossoms} شکوفه پومودورو کسب‌شده با تمرکز عمیق`}
        >
          <span>🌸</span>
          <span>{focusBlossoms} شکوفه تمرکز</span>
        </div>
      )}

      {/* 6. WATERING ANIMATION */}
      {isWatering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-fade-in">
          <div className="flex flex-col items-center gap-1">
            <Droplets className="w-9 h-9 text-sky-400 animate-bounce" />
            <span className="text-xs font-bold text-sky-300 bg-background/80 px-2 py-0.5 rounded-full border border-sky-400/40">
              شادابی و رشد 🌱
            </span>
          </div>
        </div>
      )}

      {/* 7. SVG LIVING PLANT ILLUSTRATION */}
      <svg
        viewBox="0 0 200 240"
        className="w-full h-full drop-shadow-md transition-all duration-700 z-10"
        style={{
          transform: sway ? "rotate(0.8deg)" : "rotate(-0.8deg)",
          transformOrigin: "bottom center",
        }}
      >
        <defs>
          <linearGradient id={potId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id={stemId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <radialGradient id={bloomGlowId}>
            <stop offset="0%" stopColor={meta.color} stopOpacity="1" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="0.3" />
          </radialGradient>
        </defs>

        {/* Stage 1: Seed in Soil */}
        {stage === 1 && (
          <g className="animate-pulse">
            <circle cx="100" cy="180" r="7" fill="#78350f" />
            <circle cx="100" cy="178" r="4" fill="#a16207" />
            <path d="M 100 174 Q 102 170 100 166" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Stage 2: Sprout */}
        {stage === 2 && (
          <g>
            <path d="M 100 185 Q 98 160 100 145" stroke={`url(#${stemId})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M 99 155 Q 85 145 88 138 Q 96 142 99 152" fill="#4ade80" />
            <path d="M 101 150 Q 115 140 112 133 Q 104 137 101 147" fill="#22c55e" />
          </g>
        )}

        {/* Stage 3: Sapling */}
        {stage === 3 && (
          <g>
            <path d="M 100 185 Q 96 140 100 105" stroke={`url(#${stemId})`} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M 98 150 Q 75 140 78 128 Q 92 135 98 146" fill="#22c55e" />
            <path d="M 102 142 Q 125 132 122 120 Q 108 127 102 138" fill="#16a34a" />
            <path d="M 99 120 Q 82 110 85 98 Q 96 104 99 116" fill="#4ade80" />
            <path d="M 101 115 Q 118 105 115 93 Q 104 99 101 111" fill="#4ade80" />
            <circle cx="100" cy="103" r="3.5" fill="#86efac" />
          </g>
        )}

        {/* Stage 4: Budding Plant */}
        {stage === 4 && (
          <g>
            <path d="M 100 185 Q 94 135 100 85" stroke={`url(#${stemId})`} strokeWidth="5.5" strokeLinecap="round" fill="none" />
            <path d="M 98 155 Q 70 145 74 130 Q 90 138 98 150" fill="#16a34a" />
            <path d="M 102 145 Q 130 135 126 120 Q 110 128 102 140" fill="#22c55e" />
            <path d="M 98 120 Q 74 105 80 92 Q 94 100 98 115" fill="#4ade80" />
            <path d="M 102 110 Q 126 95 120 82 Q 106 90 102 105" fill="#4ade80" />
            
            <g transform="translate(100, 80)">
              <circle cx="0" cy="0" r="10" fill={`url(#${bloomGlowId})`} />
              <path d="M -6 4 Q 0 -12 6 4 Z" fill={meta.color} />
              <path d="M -3 6 Q 0 -8 3 6 Z" fill="#ffffff" opacity="0.6" />
            </g>
          </g>
        )}

        {/* Stage 5: Full Majestic Bloom */}
        {stage === 5 && (
          <g>
            <path d="M 100 185 Q 92 130 100 75" stroke={`url(#${stemId})`} strokeWidth="6.5" strokeLinecap="round" fill="none" />
            <path d="M 97 155 Q 65 145 70 125 Q 88 135 97 150" fill="#15803d" />
            <path d="M 103 145 Q 135 135 130 115 Q 112 125 103 140" fill="#16a34a" />
            <path d="M 97 115 Q 65 98 72 82 Q 90 92 97 110" fill="#22c55e" />
            <path d="M 103 105 Q 135 88 128 72 Q 110 82 103 100" fill="#4ade80" />

            <g transform="translate(100, 70)">
              <circle cx="0" cy="0" r="26" fill={meta.glowColor} className="animate-pulse" />
              
              <circle cx="0" cy="-14" r="11" fill={meta.color} />
              <circle cx="14" cy="-5" r="11" fill={meta.color} />
              <circle cx="9" cy="12" r="11" fill={meta.color} />
              <circle cx="-9" cy="12" r="11" fill={meta.color} />
              <circle cx="-14" cy="-5" r="11" fill={meta.color} />
              
              <circle cx="0" cy="0" r="9" fill="#fef08a" />
              <circle cx="0" cy="0" r="6" fill="#f59e0b" />
            </g>
          </g>
        )}

        {/* Soil Base & Decorative Modern Pot */}
        <g id="pot">
          <ellipse cx="100" cy="186" rx="42" ry="7" fill="#451a03" />
          <path
            d="M 62 186 L 72 225 Q 100 232 128 225 L 138 186 Z"
            fill={`url(#${potId})`}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="100"
            cy="186"
            rx="40"
            ry="6"
            fill="#475569"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
          />
          <circle cx="100" cy="208" r="4" fill="#e2e8f0" opacity="0.6" />
          <path d="M 96 208 L 104 208" stroke="#38bdf8" strokeWidth="1" />
        </g>
      </svg>

      {/* Stage Badge & Name */}
      <div className="mt-2 text-center z-10">
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-background/85 backdrop-blur border shadow-xs">
          <span>{meta.badge}</span>
          <span className="text-foreground">{plant.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono">({stage}/5)</span>
          {stage === 5 && <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
        </div>
      </div>
    </div>
  );
}
