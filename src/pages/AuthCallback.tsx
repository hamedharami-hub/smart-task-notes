import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const OAUTH_RETURN_KEY = "oauth_return_to";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app/today";
  return value;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      const target = safeReturnPath(sessionStorage.getItem(OAUTH_RETURN_KEY));
      sessionStorage.removeItem(OAUTH_RETURN_KEY);
      navigate(target, { replace: true });
      return;
    }

    navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  return <div className="flex min-h-screen items-center justify-center bg-background" />;
}