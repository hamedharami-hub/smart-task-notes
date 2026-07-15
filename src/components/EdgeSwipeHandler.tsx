import { useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { haptic } from "@/lib/haptics";

/**
 * Detects edge drag/swipe gestures to open the mobile sidebar like TickTick.
 * - Swipe from left edge → right
 * - Swipe from right edge → left
 * The drawer is revealed while dragging (commit happens as soon as the
 * horizontal threshold is crossed) so it follows the finger.
 */
export default function EdgeSwipeHandler() {
  const { isMobile, setOpenMobile, openMobile } = useSidebar();

  useEffect(() => {
    if (!isMobile) return;

    const EDGE_PX = 32;
    const COMMIT_DELTA = 56;     // open once the finger has moved this far inward
    const MAX_VERTICAL = 90;

    let startX = 0;
    let startY = 0;
    let fromLeft = false;
    let fromRight = false;
    let tracking = false;

    const reset = () => {
      tracking = false;
      fromLeft = false;
      fromRight = false;
    };

    const tryOpen = () => {
      if (openMobile) return;
      haptic("light");
      setOpenMobile(true);
      reset();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (openMobile) return;
      const t = e.touches[0];
      if (!t) return;
      const w = window.innerWidth;
      fromLeft = t.clientX <= EDGE_PX;
      fromRight = t.clientX >= w - EDGE_PX;
      if (!fromLeft && !fromRight) return;
      tracking = true;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || openMobile) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > MAX_VERTICAL) { reset(); return; }
      if (fromLeft && dx > COMMIT_DELTA) tryOpen();
      else if (fromRight && dx < -COMMIT_DELTA) tryOpen();
    };

    const onTouchEnd = () => { reset(); };
    const onTouchCancel = () => { reset(); };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [isMobile, openMobile, setOpenMobile]);

  return null;
}
