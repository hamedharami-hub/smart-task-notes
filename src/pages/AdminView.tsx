import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, CheckSquare, FileText, Search, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface AdminUser {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  task_count: number;
  note_count: number;
  is_admin: boolean;
}

export default function AdminView() {
  const { isAdmin, loading } = useUserRole();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("admin_user_list");
      if (!error) setUsers((data || []) as AdminUser[]);
      setBusy(false);
    })();
  }, [isAdmin]);

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/app/today" replace />;

  const filtered = users.filter((u) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return u.email?.toLowerCase().includes(s) || u.display_name?.toLowerCase().includes(s);
  });

  const totalTasks = users.reduce((s, u) => s + Number(u.task_count || 0), 0);
  const totalNotes = users.reduce((s, u) => s + Number(u.note_count || 0), 0);

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">پنل مدیریت ARSHNAZ</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="w-4 h-4" /> کاربران</div>
          <div className="text-2xl font-bold mt-1">{users.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckSquare className="w-4 h-4" /> تسک‌ها</div>
          <div className="text-2xl font-bold mt-1">{totalTasks}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><FileText className="w-4 h-4" /> نوت‌ها</div>
          <div className="text-2xl font-bold mt-1">{totalNotes}</div>
        </Card>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو ایمیل یا نام..." className="pr-9" />
      </div>

      {busy ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <Card key={u.user_id} className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold">
                {(u.display_name || u.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{u.display_name || "—"}</span>
                  {u.is_admin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  ثبت‌نام: {new Date(u.created_at).toLocaleDateString("fa-IR")} ·
                  آخرین ورود: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fa-IR") : "هرگز"}
                </div>
              </div>
              <div className="text-end text-xs">
                <div>{u.task_count} تسک</div>
                <div className="text-muted-foreground">{u.note_count} نوت</div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">کاربری یافت نشد</p>}
        </div>
      )}
    </div>
  );
}
