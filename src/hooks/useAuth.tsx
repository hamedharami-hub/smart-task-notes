import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setGardenUser } from "@/lib/garden";

function getPersistedAuth(): { session: Session | null; user: User | null } {
  if (typeof window === "undefined") return { session: null, user: null };
  try {
    const key = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
    if (!key) return { session: null, user: null };
    const raw = localStorage.getItem(key);
    if (!raw) return { session: null, user: null };
    const parsed = JSON.parse(raw);
    const session = (parsed as Session) || null;
    const user = parsed?.user || session?.user || null;
    return { session, user };
  } catch {
    return { session: null, user: null };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function hydrateOAuthSessionFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!error) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
    return data.session;
  }

  const code = query.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      query.delete("code");
      const nextSearch = query.toString();
      window.history.replaceState({}, document.title, window.location.pathname + (nextSearch ? `?${nextSearch}` : ""));
    }
    return data.session;
  }

  return null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGardenUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    let resolved = false;
    const resolve = (u: User | null, s: Session | null) => {
      if (resolved) return;
      resolved = true;
      setSession(s);
      setUser(u);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "SIGNED_OUT") {
        // If offline, keep the persisted session so the app stays usable.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const persisted = getPersistedAuth();
          resolve(persisted.user, persisted.session);
          return;
        }
        resolve(null, null);
        return;
      }
      resolve(sess?.user ?? null, sess ?? null);
    });

    (async () => {
      const oauthSession = await hydrateOAuthSessionFromUrl();
      if (oauthSession) {
        resolve(oauthSession.user, oauthSession);
        return;
      }

      try {
        const { data: { session: sess } } = await withTimeout(supabase.auth.getSession(), 2500);
        if (sess?.user) {
          resolve(sess.user, sess);
          return;
        }
      } catch {
        // Fall through to persisted session
      }

      // Offline or session refresh failed: use the locally stored token
      const persisted = getPersistedAuth();
      resolve(persisted.user, persisted.session);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
