// Hardware/browser back button handler.
// - On root routes: show "press again to exit" toast (1st press), allow back on 2nd press
// - On non-root routes: do nothing (native history.back works)
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

const ROOT_PREFIXES = ["/app/today", "/app/tomorrow", "/app/inbox"];

function isRoot(pathname: string) {
  return ROOT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default function BackButtonHandler() {
  const loc = useLocation();
  const lastBackAt = useRef<number>(0);
  const sentinelActive = useRef<boolean>(false);

  useEffect(() => {
    // Only push a sentinel when entering a root route; remove on non-root.
    if (isRoot(loc.pathname) && !sentinelActive.current) {
      window.history.pushState({ __sentinel: true }, "");
      sentinelActive.current = true;
    }

    const onPop = (_e: PopStateEvent) => {
      // If we just left the sentinel via back press on a root route
      if (sentinelActive.current && isRoot(window.location.pathname)) {
        const now = Date.now();
        if (now - lastBackAt.current < 2000) {
          // user pressed twice → really go back (likely closes PWA)
          sentinelActive.current = false;
          window.history.back();
          return;
        }
        lastBackAt.current = now;
        // re-add sentinel and prompt
        window.history.pushState({ __sentinel: true }, "");
        toast("برای خروج، یک‌بار دیگر دکمه برگشت را بزن", { duration: 1800 });
      } else {
        // we navigated away from a root → drop sentinel flag
        sentinelActive.current = false;
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [loc.pathname]);

  return null;
}
