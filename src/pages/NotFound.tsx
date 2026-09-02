import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    console.warn("404 auto-redirecting from:", location.pathname);
    if (user) {
      navigate("/app/today", { replace: true });
    } else {
      navigate("/auth", { replace: true });
    }
  }, [location.pathname, navigate, user, loading]);

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm w-full p-6 rounded-3xl bg-card border border-border/60 shadow-xl space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-black">
          ۴۰۴
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">در حال انتقال...</h1>
          <p className="text-xs text-muted-foreground mt-1">
            در حال انتقال به صفحه اصلی برنامه
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          <Button asChild className="w-full rounded-2xl gap-2">
            <Link to="/app/today">
              <Home className="w-4 h-4" />
              ورود به برنامه (امروز)
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
