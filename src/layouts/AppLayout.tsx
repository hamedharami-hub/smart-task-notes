import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AIPanel } from "@/components/AIPanel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Search } from "lucide-react";
import OfflineIndicator from "@/components/OfflineIndicator";
import InstallPrompt from "@/components/InstallPrompt";
import EdgeSwipeHandler from "@/components/EdgeSwipeHandler";
import EdgePanBack from "@/components/EdgePanBack";
import SwipeNavigator from "@/components/gestures/SwipeNavigator";
import ClinicalDisclaimer from "@/components/ClinicalDisclaimer";
import RemindersRunner from "@/components/RemindersRunner";
import BackButtonHandler from "@/components/BackButtonHandler";
import CommandPalette from "@/components/CommandPalette";
import QuickCaptureDialog from "@/components/QuickCaptureDialog";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { BottomTabBar } from "@/components/BottomTabBar";
import { SelectionActionToolbar } from "@/components/SelectionActionToolbar";
import Onboarding from "@/components/Onboarding";
import HeaderBackButton from "@/components/HeaderBackButton";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTwoFingerSwipe } from "@/lib/useTwoFingerSwipe";
import { useThreeFingerGestures } from "@/lib/useThreeFingerGestures";
import { applyTheme, getStoredTheme, getBaseTheme } from "@/lib/theme";
import { useTheme } from "next-themes";

export default function AppLayout() {
  const [aiOpen, setAiOpen] = useState(false);
  const { setTheme } = useTheme();
  const loc = useLocation();
  useTwoFingerSwipe();
  useThreeFingerGestures({
    onQuickCapture: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true })),
    onOpenTrash: () => window.dispatchEvent(new Event("lov:open-trash")),
    onOpenSearch: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })),
  });
  useEffect(() => {
    if (loc.pathname.startsWith("/app/")) {
      try { localStorage.setItem("last_route", loc.pathname); } catch {}
    }
  }, [loc.pathname]);

  useEffect(() => {
    const stored = getStoredTheme() || "system";
    applyTheme(stored);
    setTheme(getBaseTheme(stored));
  }, [setTheme]);
  const desktopDefaultOpen =
    typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <SidebarProvider defaultOpen={desktopDefaultOpen}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="border-b flex items-center justify-between px-3 lg:px-6 bg-card/50 backdrop-blur sticky top-0 z-10"
            style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(3rem + env(safe-area-inset-top))" }}
          >
            <div className="flex items-center gap-1">
              <SidebarTrigger />
              <HeaderBackButton />
              <div id="app-header-title" className="min-w-0 flex items-center" />
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border bg-background/50 text-muted-foreground text-xs hover:bg-accent transition flex-1 max-w-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="flex-1 text-start">جستجو...</span>
                <kbd className="text-[10px] bg-muted px-1 py-0.5 rounded ltr">⌘K</kbd>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:hidden shrink-0"
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                title="جستجو"
              >
                <Search className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setAiOpen(true)} className="h-8 w-8 shrink-0" title="AI">
                <Sparkles className="w-4 h-4 text-primary" />
              </Button>
            </div>
          </header>
          <main
            id="main-scroll"
            className="flex-1 overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 lg:px-6 xl:px-10"
          >
            <div
              key={loc.pathname}
              className="animate-fade-in motion-reduce:animate-none w-full mx-auto lg:max-w-[1100px] xl:max-w-[1280px] 2xl:max-w-[1440px]"
            >
              <Outlet />
            </div>
          </main>
        </div>
        <AIPanel open={aiOpen} onOpenChange={setAiOpen} />
        <OfflineIndicator />
        <InstallPrompt />
        <EdgeSwipeHandler />
        <EdgePanBack />
        <SwipeNavigator />
        <ClinicalDisclaimer />
        <RemindersRunner />
        <BackButtonHandler />
        <CommandPalette />
        <QuickCaptureDialog />
        <KeyboardShortcutsDialog />
        <BottomTabBar />
        <Onboarding />
        <SelectionActionToolbar />
      </div>
    </SidebarProvider>
  );
}
