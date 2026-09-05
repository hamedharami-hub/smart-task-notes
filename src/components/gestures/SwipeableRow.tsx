import { ReactNode, useRef, useState, TouchEvent, useEffect, type ComponentType } from "react";
import { Check, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";

export interface SwipeAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  baseClass?: string;
  activeClass?: string;
  textClass?: string;
  onActivate: () => void;
  /** If true, a full swipe past {@link fullRatio} triggers this action instantly. */
  fullSwipe?: boolean;
}

interface Props {
  children: ReactNode;
  rightActions?: SwipeAction[];
  leftActions?: SwipeAction[];
  /** Legacy shorthand: creates a single right action (Complete). */
  onComplete?: () => void;
  /** Legacy shorthand: creates a single left action (Delete). */
  onDelete?: () => void;
  disabled?: boolean;
  isCompleted?: boolean;
  rightLabel?: string;
  rightLabelAlt?: string;
  leftLabel?: string;
  RightIcon?: ComponentType<{ className?: string }>;
  rightColor?: "emerald" | "amber" | "primary";
  segmentWidth?: number;
  /** Ratio of row width that triggers a full-swipe (default 0.55). */
  fullRatio?: number;
}

const DEFAULT_SEGMENT = 84; // px per action slot
const FULL_RATIO = 0.72;
const MIN_COMMIT = 44; // px past which a partial release commits the active action
const DIRECTION_THRESHOLD = 14; // px before deciding horizontal vs vertical swipe

export default function SwipeableRow({
  children,
  rightActions: propRight,
  leftActions: propLeft,
  onComplete,
  onDelete,
  disabled,
  isCompleted,
  rightLabel,
  rightLabelAlt,
  leftLabel,
  RightIcon = Check,
  rightColor = "emerald",
  segmentWidth = DEFAULT_SEGMENT,
  fullRatio = FULL_RATIO,
}: Props) {
  const colorMap = {
    emerald: { base: "bg-emerald-500/80", active: "bg-emerald-700", text: "text-white" },
    amber: { base: "bg-amber-500/80", active: "bg-amber-700", text: "text-white" },
    primary: { base: "bg-primary/70", active: "bg-primary", text: "text-white" },
  } as const;
  const rc = colorMap[rightColor];

  const rightActions: SwipeAction[] =
    propRight ??
    (onComplete
      ? [
          {
            id: "complete",
            label: isCompleted ? rightLabelAlt ?? "بازگشایی" : rightLabel ?? "تکمیل",
            icon: RightIcon,
            baseClass: rc.base,
            activeClass: rc.active,
            textClass: rc.text,
            onActivate: onComplete,
            fullSwipe: true,
          },
        ]
      : []);

  const leftActions: SwipeAction[] =
    propLeft ??
    (onDelete
      ? [
          {
            id: "delete",
            label: leftLabel ?? "حذف",
            icon: Trash2,
            baseClass: "bg-destructive/80",
            activeClass: "bg-red-700",
            textClass: "text-white",
            onActivate: onDelete,
            fullSwipe: true,
          },
        ]
      : []);

  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [commitSide, setCommitSide] = useState<"none" | "right" | "left">("none");
  const wrapRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const decided = useRef<"h" | "v" | null>(null);
  const activeIndex = useRef(-1);

  useEffect(() => {
    if (wrapRef.current) widthRef.current = wrapRef.current.clientWidth;
  });

  if (disabled) return <>{children}</>;

  const getActions = (side: "right" | "left") => (side === "right" ? rightActions : leftActions);

  const activeAction = (side: "right" | "left", pos: number) => {
    const actions = getActions(side);
    if (actions.length === 0 || pos <= 0) return -1;
    return Math.min(Math.floor((pos - 1) / segmentWidth), actions.length - 1);
  };

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
    activeIndex.current = -1;
    setAnimating(false);
    setCommitSide("none");
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

    const actions = ddx > 0 ? rightActions : leftActions;
    const maxActions = actions.length;
    const maxDx = Math.max(0, maxActions * segmentWidth);
    const clamped = Math.max(-maxDx, Math.min(maxDx, ddx));
    setDx(clamped);

    const side: "right" | "left" = clamped > 0 ? "right" : "left";
    const pos = Math.abs(clamped);
    const idx = activeAction(side, pos);
    if (idx !== activeIndex.current && idx >= 0) {
      activeIndex.current = idx;
      haptic("light");
    }

    const w = widthRef.current || 320;
    const fullPx = w * fullRatio;
    if (commitSide === "none" && pos >= fullPx) {
      const fullAction = getActions(side).find((a) => a.fullSwipe) || getActions(side)[0];
      if (fullAction) {
        setCommitSide(side);
        haptic(side === "right" ? "success" : "warning");
        fullAction.onActivate();
        tracking.current = false;
        setAnimating(true);
        setDx(side === "right" ? w : -w);
        window.setTimeout(() => {
          setAnimating(true);
          setDx(0);
          setCommitSide("none");
          activeIndex.current = -1;
        }, 180);
      }
    }
  };

  const reset = () => {
    setAnimating(true);
    setDx(0);
    tracking.current = false;
    activeIndex.current = -1;
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!tracking.current) return;
    if (decided.current !== "h") {
      reset();
      return;
    }
    e.preventDefault();
    const pos = Math.abs(dx);
    if (pos < MIN_COMMIT) {
      reset();
      return;
    }
    const side: "right" | "left" = dx > 0 ? "right" : "left";
    const idx = activeAction(side, pos);
    const actions = getActions(side);
    if (idx >= 0 && actions[idx]) {
      haptic("light");
      actions[idx].onActivate();
    }
    reset();
  };

  const showRight = dx > 4 && rightActions.length > 0;
  const showLeft = dx < -4 && leftActions.length > 0;
  const pos = Math.abs(dx);
  const activeRight = dx > 0 ? activeAction("right", pos) : -1;
  const activeLeft = dx < 0 ? activeAction("left", pos) : -1;

  const segmentWidthFor = (i: number, side: "right" | "left") => {
    const actions = getActions(side);
    if (i >= actions.length) return 0;
    return Math.min(segmentWidth, Math.max(0, pos - i * segmentWidth));
  };

  return (
    <div ref={wrapRef} data-no-swipe-nav className="relative overflow-hidden rounded-lg" style={{ touchAction: "pan-y" }}>
      {showRight && (
        <div className="absolute inset-y-0 start-0 flex flex-row overflow-hidden" style={{ width: pos }} aria-hidden>
          {rightActions.map((a, i) => {
            const w = segmentWidthFor(i, "right");
            if (w <= 0) return null;
            const active = i === activeRight && pos > MIN_COMMIT;
            const Icon = a.icon;
            return (
              <div
                key={a.id}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-1 ${a.textClass || "text-white"} ${active ? a.activeClass || a.baseClass : a.baseClass}`}
                style={{ width: w }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight text-center line-clamp-2">{a.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {showLeft && (
        <div className="absolute inset-y-0 end-0 flex flex-row-reverse overflow-hidden" style={{ width: pos }} aria-hidden>
          {leftActions.map((a, i) => {
            const w = segmentWidthFor(i, "left");
            if (w <= 0) return null;
            const active = i === activeLeft && pos > MIN_COMMIT;
            const Icon = a.icon;
            return (
              <div
                key={a.id}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-1 ${a.textClass || "text-white"} ${active ? a.activeClass || a.baseClass : a.baseClass}`}
                style={{ width: w }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight text-center line-clamp-2">{a.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <div
        data-no-swipe-nav
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
