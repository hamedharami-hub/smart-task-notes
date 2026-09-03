import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { installUndoShortcuts } from "@/lib/undoStack";
import { toast } from "sonner";
import { ThemeProvider } from "next-themes";
import { getStoredTheme, getBaseTheme } from "@/lib/theme";

function usePwaUpdateToast() {
  useEffect(() => {
    const onUpdate = () => {
      toast("نسخه‌ی جدید برنامه آماده است", {
        description: "برای دریافت امکانات جدید، برنامه را به‌روزرسانی کن.",
        duration: Infinity,
        action: {
          label: "به‌روزرسانی",
          onClick: () => {
            const apply = (window as any).__applyPwaUpdate;
            if (typeof apply === "function") apply();
            else window.location.reload();
          },
        },
      });
    };
    window.addEventListener("pwa-update-available", onUpdate);
    return () => window.removeEventListener("pwa-update-available", onUpdate);
  }, []);
}

// Keep entry-critical routes eager so first paint isn't gated on a chunk
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Lazy-load everything else — each page becomes its own chunk, slashing initial JS
const AppLayout = lazy(() => import("@/layouts/AppLayout"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const TasksView = lazy(() => import("./pages/TasksView"));
const NotesView = lazy(() => import("./pages/NotesView"));
const HabitsView = lazy(() => import("./pages/HabitsView"));
const GardenView = lazy(() => import("./pages/GardenView"));
const PomodoroView = lazy(() => import("./pages/PomodoroView"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const StatsView = lazy(() => import("./pages/StatsView"));
const SettingsView = lazy(() => import("./pages/SettingsView"));
const KanbanView = lazy(() => import("./pages/KanbanView"));

const SelfKnowledgeView = lazy(() => import("./pages/SelfKnowledgeView"));
const MindView = lazy(() => import("./pages/MindView"));
const LifeArchitectView = lazy(() => import("./pages/LifeArchitectView"));
const AssessmentRunner = lazy(() => import("./pages/AssessmentRunner"));
const AssessmentResult = lazy(() => import("./pages/AssessmentResult"));
const CheckinView = lazy(() => import("./pages/CheckinView"));
const ThoughtRecordsView = lazy(() => import("./pages/ThoughtRecordsView"));
const ABCView = lazy(() => import("./pages/ABCView"));
const SocraticView = lazy(() => import("./pages/SocraticView"));
const AboutMeView = lazy(() => import("./pages/AboutMeView"));
const BreathingView = lazy(() => import("./pages/BreathingView"));
const ScreenerView = lazy(() => import("./pages/ScreenerView"));
const ValuesGoalsView = lazy(() => import("./pages/ValuesGoalsView"));
const WorryView = lazy(() => import("./pages/WorryView"));
const CycleView = lazy(() => import("./pages/CycleView"));

const NewTaskView = lazy(() => import("./pages/NewTaskView"));
const NewNoteView = lazy(() => import("./pages/NewNoteView"));
const TaskDetailView = lazy(() => import("./pages/TaskDetailView"));
const AdminView = lazy(() => import("./pages/AdminView"));
const SharedWithMeView = lazy(() => import("./pages/SharedWithMeView"));
const ShareTargetView = lazy(() => import("./pages/ShareTargetView"));
const BucketsView = lazy(() => import("./pages/BucketsView"));
const ArticleRewriteView = lazy(() => import("./pages/ArticleRewriteView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1m: avoid refetch storms
      gcTime: 5 * 60_000,       // 5m cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background" />
);

import { App as CapApp } from "@capacitor/app";

function CapacitorUrlHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    let handle: any = null;
    try {
      CapApp.addListener("appUrlOpen", (event) => {
        const url = event.url || "";
        if (url.includes("add_task") || url.includes("new-task")) {
          navigate("/app/new-task");
        } else if (url.includes("today")) {
          navigate("/app/today");
        } else if (url.includes("checkin")) {
          navigate("/app/checkin");
        } else if (url.includes("garden")) {
          navigate("/app/garden");
        } else if (url.includes("pomodoro")) {
          navigate("/app/pomodoro");
        }
      }).then((h) => {
        handle = h;
      });
    } catch (e) {
      console.warn("Capacitor appUrlOpen error:", e);
    }
    return () => {
      handle?.remove?.();
    };
  }, [navigate]);
  return null;
}

const App = () => {
  useEffect(() => installUndoShortcuts(), []);
  usePwaUpdateToast();
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme={getBaseTheme(getStoredTheme() || "system")} storageKey="__arshnaz_base_theme" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CapacitorUrlHandler />
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/index.html" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

                {/* Root shortcut aliases */}
                <Route path="/today" element={<Navigate to="/app/today" replace />} />
                <Route path="/inbox" element={<Navigate to="/app/inbox" replace />} />
                <Route path="/garden" element={<Navigate to="/app/garden" replace />} />
                <Route path="/pomodoro" element={<Navigate to="/app/pomodoro" replace />} />
                <Route path="/checkin" element={<Navigate to="/app/checkin" replace />} />
                <Route path="/notes" element={<Navigate to="/app/notes" replace />} />
                <Route path="/habits" element={<Navigate to="/app/habits" replace />} />
                <Route path="/calendar" element={<Navigate to="/app/calendar" replace />} />
                <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
                <Route path="/life-architect" element={<Navigate to="/app/life-architect" replace />} />
                <Route path="/new-task" element={<Navigate to="/app/new/task" replace />} />
                <Route path="/new/task" element={<Navigate to="/app/new/task" replace />} />

                <Route path="/app" element={<ProtectedRoute><ErrorBoundary><AppLayout /></ErrorBoundary></ProtectedRoute>}>
                  <Route index element={<Navigate to="today" replace />} />
                  
                  <Route path="inbox" element={<TasksView scope="inbox" />} />
                  <Route path="today" element={<TasksView scope="today" />} />
                  <Route path="tomorrow" element={<TasksView scope="tomorrow" />} />
                  <Route path="next7" element={<TasksView scope="next7" />} />
                  <Route path="smart" element={<TasksView scope="smart" />} />
                  <Route path="folder/:id" element={<TasksView scope="folder" />} />
                  <Route path="tag/:id" element={<TasksView scope="tag" />} />
                  <Route path="notes" element={<NotesView />} />
                  <Route path="habits" element={<HabitsView />} />
                  <Route path="garden" element={<GardenView />} />
                  <Route path="pomodoro" element={<PomodoroView />} />
                  <Route path="calendar" element={<CalendarView />} />
                  <Route path="stats" element={<StatsView />} />
                  <Route path="kanban" element={<KanbanView />} />
                  <Route path="buckets" element={<BucketsView />} />
                  
                  <Route path="mind" element={<MindView />} />
                  <Route path="self" element={<SelfKnowledgeView />} />
                  <Route path="self/test/:type" element={<AssessmentRunner />} />
                  <Route path="self/result/:type" element={<AssessmentResult />} />
                  <Route path="checkin" element={<CheckinView />} />
                  <Route path="thoughts" element={<ThoughtRecordsView />} />
                  <Route path="abc" element={<ABCView />} />
                  <Route path="socratic" element={<SocraticView />} />
                  <Route path="breathing" element={<BreathingView />} />
                  <Route path="screener/:type" element={<ScreenerView />} />
                  <Route path="values" element={<ValuesGoalsView />} />
                  <Route path="life-architect" element={<LifeArchitectView />} />
                  <Route path="worry" element={<WorryView />} />
                  <Route path="cycle" element={<CycleView />} />
                  <Route path="about-me" element={<AboutMeView />} />
                  <Route path="settings" element={<SettingsView />} />
                  <Route path="admin" element={<AdminView />} />
                  <Route path="shared" element={<SharedWithMeView />} />
                  <Route path="new/task" element={<NewTaskView />} />
                  <Route path="new-task" element={<Navigate to="/app/new/task" replace />} />
                  <Route path="new/note" element={<NewNoteView />} />
                  <Route path="new-note" element={<Navigate to="/app/new/note" replace />} />
                  <Route path="share-target" element={<ShareTargetView />} />
                  <Route path="rewrite-article" element={<ArticleRewriteView />} />
                  <Route path="tasks/:id" element={<TaskDetailView />} />
                  <Route path="widgets" element={<Navigate to="/app/today" replace />} />
                  <Route path="widget/:id" element={<Navigate to="/app/today" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
