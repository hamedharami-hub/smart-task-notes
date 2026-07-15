import { ReactNode, useRef, useState, TouchEvent, useEffect } from "react";
import { Check, Trash2, Zap } from "lucide-react";
import { haptic } from "@/lib/haptics";

interface Props {
  children: ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  isCompleted?: boolean;
  rightLabel?: string;
  rightLabelAlt?: string;
  leftLabel?: string;
  RightIcon?: typeof Check;
  rightColor?: "emerald" | "amber" | "primary";
}

const ACTION_THRESHOLD = 96;     // px past which the action commits on release
const FULL_RATIO = 0.6;          // % of width past which we commit instantly (full-swipe)
const REVEAL_MAX_RATIO = 0.85;   // visual cap relative to row width

/**
 * Touch-only horizontal swipe wrapper (iOS-Mail-style).
 * - Swipe past ACTION_THRESHOLD on release → run action.
 * - Full-swipe past 60% of row width → instant commit (no release needed),
 *   strong haptic, and the underlay color intensifies.
 * - Swipe LEFT  → delete (red).
 * - Swipe RIGHT → complete (green).
 */
export default function SwipeableRow({
  children,
  onComplete,
  onDelete,
  disabled,
  isCompleted,
  rightLabel,
  rightLabelAlt,
  leftLabel,
  RightIcon = Check,
  rightColor = "emerald",
}: Props) {
  const colorMap = {
    emerald: { full: "bg-emerald-700", armed: "bg-emerald-600", base: "bg-emerald-500/80" },
    amber: { full: "bg-amber-700", armed: "bg-amber-600", base: "bg-amber-500/80" },
    primary: { full: "bg-primary", armed: "bg-primary/90", base: "bg-primary/70" },
  } as const;
  const rc = colorMap[rightColor];
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [committedFull, setCommittedFull] = useState<"none" | "right" | "left">("none");
  const wrapRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const decided = useRef<"h" | "v" | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (wrapRef.current) widthRef.current = wrapRef.current.clientWidth;
  });

  if (disabled) return <>{children}</>;

  const onTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-drag-handle], [data-no-swipe]")) return;
    const t = e.touches[0];
    if (!t) return;
    if (wrapRef.current) widthRef.current = wrapRef.current.clientWidth;
    startX.current = t.clientX;
    startY.current = t.clientY;
    tracking.current = true;
    decided.current = null;
    armed.current = false;
    setAnimating(false);
    setCommittedFull("none");
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!tracking.current) return;
    const t = e.touches[0];
    const ddx = t.clientX - startX.current;
    const ddy = t.clientY - startY.current;
    if (decided.current === null) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      decided.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
    }
    if (decided.current !== "h") return;
    const w = widthRef.current || 320;
    const cap = w * REVEAL_MAX_RATIO;
    const clamped = Math.max(-cap, Math.min(cap, ddx));
    setDx(clamped);

    // Threshold haptic
    if (!armed.current && Math.abs(clamped) >= ACTION_THRESHOLD) {
      armed.current = true;
      haptic("light");
    } else if (armed.current && Math.abs(clamped) < ACTION_THRESHOLD) {
      armed.current = false;
    }

    // Full-swipe instant commit
    const fullPx = w * FULL_RATIO;
    if (committedFull === "none" && Math.abs(clamped) >= fullPx) {
      if (clamped > 0 && onComplete) {
        setCommittedFull("right");
        haptic("success");
        onComplete();
        // animate out then reset
        tracking.current = false;
        setAnimating(true);
        setDx(w);
        window.setTimeout(() => { setAnimating(true); setDx(0); setCommittedFull("none"); }, 180);
      } else if (clamped < 0 && onDelete) {
        setCommittedFull("left");
        haptic("warning");
        onDelete();
        tracking.current = false;
        setAnimating(true);
        setDx(-w);
        window.setTimeout(() => { setAnimating(true); setDx(0); setCommittedFull("none"); }, 180);
      }
    }
  };

  const reset = () => {
    setAnimating(true);
    setDx(0);
    tracking.current = false;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!tracking.current) return;
    if (decided.current !== "h") {
      reset();
      return;
    }
    e.preventDefault();
    const final = dx;
    if (final >= ACTION_THRESHOLD && onComplete) {
      haptic("success");
      onComplete();
      reset();
    } else if (final <= -ACTION_THRESHOLD && onDelete) {
      haptic("warning");
      onDelete();
      reset();
    } else {
      reset();
    }
  };

  const showRight = dx > 4;
  const showLeft = dx < -4;
  const w = widthRef.current || 320;
  const isFull = Math.abs(dx) >= w * FULL_RATIO;

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-lg" style={{ touchAction: "pan-y" }}>
      {showRight && (
        <div
          className={`absolute inset-y-0 start-0 flex items-center gap-2 px-4 text-white ${
            isFull ? rc.full : armed.current ? rc.armed : rc.base
          }`}
          style={{ width: Math.abs(dx) + 16 }}
          aria-hidden
        >
          {isFull ? <Zap className="w-5 h-5" /> : <RightIcon className="w-5 h-5" />}
          <span className="text-xs font-medium">
            {isFull ? "آنی!" : (isCompleted ? (rightLabelAlt ?? "بازگشایی") : (rightLabel ?? "تکمیل"))}
          </span>
        </div>
      )}
      {showLeft && (
        <div
          className={`absolute inset-y-0 end-0 flex items-center justify-end gap-2 px-4 text-white ${
            isFull ? "bg-red-700" : armed.current ? "bg-destructive" : "bg-destructive/80"
          }`}
          style={{ width: Math.abs(dx) + 16 }}
          aria-hidden
        >
          <span className="text-xs font-medium">{isFull ? "آنی!" : (leftLabel ?? "حذف")}</span>
          {isFull ? <Zap className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
        </div>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={(e) => { e.preventDefault(); reset(); }}
        style={{
          transform: `translate3d(${dx}px,0,0)`,
          transition: animating ? "transform 180ms ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
