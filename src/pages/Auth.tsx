import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const DISCLAIMER_KEY = "clinical_disclaimer_accepted_v1";
const OAUTH_RETURN_KEY = "oauth_return_to";

async function getAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return data.user;

  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.user ?? null;
}

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(() => localStorage.getItem(DISCLAIMER_KEY) === "1");

  // Preserve `next` (e.g. /.lovable/oauth/consent?authorization_id=...) so the
  // MCP consent flow returns here to the exact request instead of the app root.
  const rawNext = params.get("next") || "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const returnTo = safeNext || "/app/today";
  const absoluteReturnTo = `${window.location.origin}${returnTo}`;

  useEffect(() => {
    if (!authLoading && user) navigate(returnTo, { replace: true });
  }, [user, authLoading, navigate, returnTo]);

  const requireDisclaimer = () => {
    if (!accepted) { toast.error("لطفاً ابتدا مسئولیت‌نامه بالینی را تأیید کن"); return false; }
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDisclaimer()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("خوش آمدید!"); navigate(returnTo); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDisclaimer()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: absoluteReturnTo,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else if (data.session) { toast.success("حساب ساخته شد!"); navigate(returnTo); }
    else toast.success("حساب ساخته شد؛ لطفاً ایمیل تأیید را بررسی کن.");
  };

  const handleGoogle = async () => {
    if (!requireDisclaimer()) return;
    setLoading(true);
    try {
      sessionStorage.setItem(OAUTH_RETURN_KEY, returnTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطا در ورود با گوگل";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir={isEn ? "ltr" : "rtl"} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-background to-purple-50 dark:from-pink-950/20 dark:via-background dark:to-purple-950/20 p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <div className="flex flex-col items-center mb-6">
          <img src="/favicon.png" alt="ARSHNAZ" className="w-16 h-16 rounded-2xl shadow-lg mb-3" width={64} height={64} />
          <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-l from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            ARSHNAZ
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isEn ? "Arshnaz · Manage tasks with love" : "ارشناز · مدیریت تسک با عشق"}
          </p>
          <p className="text-[11px] text-pink-600 dark:text-pink-400 mt-2 flex items-center gap-1">
            {t("auth.dedication")}
          </p>
        </div>

        <Alert className="mb-4 border-amber-500/40 bg-amber-500/5">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-xs leading-6">
            این اپ ابزار <strong>خودمدیریتی مبتنی بر شواهد</strong> است و جایگزین روان‌درمانی، تشخیص بالینی یا دارودرمانی نیست. در صورت علائم شدید یا پایدار، حتماً به متخصص مراجعه کن.
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <Checkbox checked={accepted} onCheckedChange={(v) => {
                const ok = v === true;
                setAccepted(ok);
                if (ok) localStorage.setItem(DISCLAIMER_KEY, "1"); else localStorage.removeItem(DISCLAIMER_KEY);
              }} />
              <span className="text-xs">مسئولیت‌نامه را خواندم و می‌پذیرم.</span>
            </label>
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="signin">ورود</TabsTrigger>
            <TabsTrigger value="signup">ثبت‌نام</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email-in">ایمیل</Label>
                <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pass-in">رمز عبور</Label>
                <Input id="pass-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "..." : "ورود"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="name-up">نام</Label>
                <Input id="name-up" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email-up">ایمیل</Label>
                <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pass-up">رمز عبور</Label>
                <Input id="pass-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "..." : "ساخت حساب"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">یا</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
          <svg className="w-4 h-4 me-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          ادامه با گوگل
        </Button>
      </Card>
    </main>
  );
}
