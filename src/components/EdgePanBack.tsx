import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { haptic } from "@/lib/haptics";

/**
 * iOS-style edge-pan to navigate back.
 * - In RTL UIs, "back" feels natural from the LEFT edge → swipe right.
 * - Provides a live, opacity-growing chevron indicator while dragging.
 * - Skips on root /app/* primary routes (handled by BackButtonHandler).
 */
const EDGE = 22;
const TRIGGER = 80;
const NO_BACK_PATHS = new Set([
  "/app/today", "/app/tomorrow", "/app/inbox",
  "/app/notes", "/app/calendar", "/app/habits", "/app/next7",
]);

export default function EdgePanBack() {
  const navigate = useNavigate();
  const loc = useLocation();
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const fromLeft = useRef(false);
  const [dx, setDx] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;

    const onStart = (e: TouchEvent) => {
      if (NO_BACK_PATHS.has(loc.pathname)) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      const fl = t.clientX <= EDGE;
      const fr = t.clientX >= w - EDGE;
      if (!fl && !fr) return;
      tracking.current = true;
      fromLeft.current = fl;
      startX.current = t.clientX;
      startY.current = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking.current) return;
      const t = e.touches[0];
      const ddx = t.clientX - startX.current;
      const ddy = Math.abs(t.clientY - startY.current);
      if (ddy > 60) { tracking.current = false; setDx(0); return; }
      // Only count motion in the "back" direction
      const dir = fromLeft.current ? 1 : -1;
      const eff = dir === 1 ? Math.max(0, ddx) : Math.min(0, ddx);
      setDx(eff);
    };
    const onEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      const abs = Math.abs(dx);
      if (abs >= TRIGGER) {
        haptic("medium");
        // small visual settle then navigate back
        setDx(0);
        navigate(-1);
      } else {
        setDx(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [loc.pathname, navigate, dx]);

  if (dx === 0) return null;
  const abs = Math.min(Math.abs(dx), 140);
  const opacity = Math.min(1, abs / TRIGGER);
  const armed = abs >= TRIGGER;
  const fromLeftSide = fromLeft.current;
  return (
    <div
      aria-hidden
      className="fixed inset-y-0 z-[60] pointer-events-none flex items-center"
      style={{
        [fromLeftSide ? "left" : "right"]: 0,
        width: abs + 24,
      } as any}
    >
      <div
        className={`flex items-center justify-center rounded-full shadow-lg backdrop-blur transition-colors ${
          armed ? "bg-primary text-primary-foreground" : "bg-card/90 text-foreground border border-border"
        }`}
        style={{
          width: 44, height: 44,
          marginInlineStart: fromLeftSide ? Math.max(8, abs - 28) : undefined,
          marginInlineEnd: !fromLeftSide ? Math.max(8, abs - 28) : undefined,
          opacity,
          transform: `scale(${0.8 + opacity * 0.3})`,
        }}
      >
        {fromLeftSide ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </div>
    </div>
  );
}
