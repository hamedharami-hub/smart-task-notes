import { useLocation, useNavigate } from "react-router-dom";
import { ListTodo, Calendar, Plus, Settings, PanelRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { haptic } from "@/lib/haptics";
import { useSidebar } from "@/components/ui/sidebar";
import RecentlyDeletedSheet from "@/components/RecentlyDeletedSheet";

type Tab = { key: string; to: string; icon: typeof ListTodo; fa: string; en: string; match: (p: string) => boolean };

export function BottomTabBar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [trashOpen, setTrashOpen] = useState(false);

  // Allow other parts of the app to open the trash via a global event.
  useEffect(() => {
    const open = () => setTrashOpen(true);
    window.addEventListener("lov:open-trash", open);
    return () => window.removeEventListener("lov:open-trash", open);
  }, []);

  if (!loc.pathname.startsWith("/app")) return null;

  const openQuickCapture = () => {
    haptic("medium");
    window.dispatchEvent(new Event("lov:open-quick-capture"));
  };

  const tabs: Tab[] = [
    { key: "today", to: "/app/today", icon: ListTodo, fa: "امروز", en: "Today", match: (p) => p === "/app/today" || p === "/app/home" || p === "/app" },
    { key: "calendar", to: "/app/calendar", icon: Calendar, fa: "تقویم", en: "Calendar", match: (p) => p.startsWith("/app/calendar") },
    { key: "settings", to: "/app/settings", icon: Settings, fa: "تنظیمات", en: "Settings", match: (p) => p.startsWith("/app/settings") },
  ];

  const go = (to: string) => { haptic("light"); navigate(to); };

  const itemClass = (active: boolean) =>
    `h-full flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] select-none active:scale-95 transition ${
      active ? "text-primary" : "text-foreground/60"
    }`;

  // Split tabs so the Add button sits in the center.
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border flex items-stretch h-14"
        style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={T("نوار پایین", "Bottom bar")}
      >
        {left.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(loc.pathname);
          return (
            <button
              key={tab.key}
              type="button"
              className={itemClass(active)}
              aria-label={T(tab.fa, tab.en)}
              aria-current={active ? "page" : undefined}
              onClick={() => go(tab.to)}
            >
              <Icon className="w-5 h-5" />
              <span>{T(tab.fa, tab.en)}</span>
            </button>
          );
        })}

        <div className="flex-1 flex items-center justify-center">
          <button
            type="button"
            onClick={openQuickCapture}
            aria-label={T("افزودن سریع", "Quick add")}
            className="-mt-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition ring-4 ring-background"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {right.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(loc.pathname);
          return (
            <button
              key={tab.key}
              type="button"
              className={itemClass(active)}
              aria-label={T(tab.fa, tab.en)}
              aria-current={active ? "page" : undefined}
              onClick={() => go(tab.to)}
            >
              <Icon className="w-5 h-5" />
              <span>{T(tab.fa, tab.en)}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={itemClass(false)}
          aria-label={T("منو", "Menu")}
          onClick={() => { haptic("light"); toggleSidebar(); }}
        >
          <PanelRight className="w-5 h-5" />
          <span>{T("منو", "Menu")}</span>
        </button>
      </nav>

      <RecentlyDeletedSheet open={trashOpen} onOpenChange={setTrashOpen} />
    </>
  );
}
