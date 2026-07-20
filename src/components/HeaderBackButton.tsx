import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Routes considered "root" — no back button should appear.
const ROOT_PATHS = new Set([
  "/app",
  "/app/today",
  "/app/inbox",
]);

export default function HeaderBackButton() {
  const loc = useLocation();
  const navigate = useNavigate();

  if (!loc.pathname.startsWith("/app")) return null;
  if (ROOT_PATHS.has(loc.pathname)) return null;

  const onClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/app/today");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="بازگشت"
      className="h-8 w-8"
    >
      {/* RTL: arrow pointing right means "back" */}
      <ArrowRight className="w-5 h-5" />
    </Button>
  );
}
