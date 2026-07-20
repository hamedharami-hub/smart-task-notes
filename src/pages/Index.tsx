import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { loadSettings } from "@/lib/reminders";

const Index = () => {
  const { user, loading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setTarget("/auth"); return; }
    (async () => {
      try {
        const s = await loadSettings(user.id);
        const lastPath = localStorage.getItem("last_route");
        if (s?.default_landing === "today") {
          setTarget("/app/today");
        } else if (s?.default_landing === "last" && lastPath && lastPath.startsWith("/app/")) {
          setTarget(lastPath);
        } else {
          setTarget("/app/today");
        }
      } catch {
        setTarget("/app/today");
      }
    })();
  }, [user, loading]);

  if (!target) return null;
  return <Navigate to={target} replace />;
};
export default Index;
