import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, FileText, FolderTree, Eye, MessageSquare, Pencil, Users, Check, X, Loader2 } from "lucide-react";
import { BidiText } from "@/components/BidiText";
import { toast } from "sonner";

type Row = {
  id: string;
  resource_type: "task" | "note" | "folder";
  resource_id: string;
  permission: "view" | "comment" | "edit";
  owner_id: string;
  ownerName?: string;
  accepted_at: string | null;
  created_at: string;
  title?: string;
};

const TYPE_META: Record<Row["resource_type"], { icon: ComponentType<{ className?: string }>; route: (id: string) => string; label_fa: string; label_en: string }> = {
  task: { icon: CheckSquare, route: (id) => `/app/tasks/${id}`, label_fa: "تسک", label_en: "Task" },
  note: { icon: FileText, route: (id) => `/app/notes?select=${id}`, label_fa: "نوت", label_en: "Note" },
  folder: { icon: FolderTree, route: (id) => `/app/folder/${id}`, label_fa: "فولدر", label_en: "Folder" },
};

const PERM_ICON = { view: Eye, comment: MessageSquare, edit: Pencil } as const;

export default function SharedWithMeView() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const email = (user.email || "").toLowerCase();
    const { data: shares } = await supabase.from("shares")
      .select("*")
      .or(`recipient_id.eq.${user.id},recipient_email.ilike.${email}`)
      .neq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .returns<Row[]>();
    const list = (shares || []) as Row[];

    const groups: Record<string, string[]> = { task: [], note: [], folder: [] };
    list.forEach((s) => groups[s.resource_type]?.push(s.resource_id));

    const titles: Record<string, string> = {};
    const ownerIds = Array.from(new Set(list.map((s) => s.owner_id)));

    const [t, n, f, p] = await Promise.all([
      groups.task.length ? supabase.from("tasks").select("id,title").in("id", groups.task) : Promise.resolve({ data: [] }),
      groups.note.length ? supabase.from("notes").select("id,title").in("id", groups.note) : Promise.resolve({ data: [] }),
      groups.folder.length ? supabase.from("folders").select("id,name").in("id", groups.folder) : Promise.resolve({ data: [] }),
      ownerIds.length ? supabase.from("profiles").select("id,display_name").in("id", ownerIds) : Promise.resolve({ data: [] }),
    ]);

    type Named = { id: string; title?: string | null; name?: string | null; display_name?: string | null };
    const cast = (x: unknown) => (x || []) as Named[];
    cast(t.data).forEach((r) => { if (r.title) titles[`task:${r.id}`] = r.title; });
    cast(n.data).forEach((r) => { if (r.title) titles[`note:${r.id}`] = r.title; });
    cast(f.data).forEach((r) => { if (r.name) titles[`folder:${r.id}`] = r.name; });
    const owners: Record<string, string> = {};
    cast(p.data).forEach((r) => { if (r.display_name) owners[r.id] = r.display_name; });

    setRows(
      list.map((s) => {
        const title = titles[`${s.resource_type}:${s.resource_id}`];
        const pendingLabel = s.accepted_at ? null : T("دعوت به اشتراک", "Sharing invitation");
        return {
          ...s,
          title: pendingLabel || title || T("بدون عنوان", "Untitled"),
          ownerName: owners[s.owner_id] || T("کاربر", "User"),
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("shared-with-me")
      .on("postgres_changes", { event: "*", schema: "public", table: "shares" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const accept = async (id: string) => {
    setActingId(id);
    try {
      const { error } = await supabase.rpc("accept_share", { _share_id: id });
      if (error) throw error;
      toast.success(T("پذیرفته شد", "Accepted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setActingId(null);
      load();
    }
  };

  const decline = async (id: string) => {
    setActingId(id);
    try {
      const { error } = await supabase.rpc("decline_share", { _share_id: id });
      if (error) throw error;
      toast.success(T("رد شد", "Declined"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("خطا", "Error"));
    } finally {
      setActingId(null);
      load();
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <header className="mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">{T("به اشتراک گذاشته‌شده با من", "Shared with me")}</h1>
      </header>

      {loading && <p className="text-center text-muted-foreground py-8">{T("در حال بارگذاری…", "Loading…")}</p>}
      {!loading && rows.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          {T("هنوز چیزی با شما به اشتراک گذاشته نشده.", "Nothing has been shared with you yet.")}
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const meta = TYPE_META[r.resource_type];
          const Icon = meta.icon;
          const PIcon = PERM_ICON[r.permission];
          const pending = !r.accepted_at;
          const busy = actingId === r.id;
          return (
            <Card key={r.id} className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <BidiText as="div" text={r.title || ""} className="font-medium text-sm truncate" />
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span>{T(meta.label_fa, meta.label_en)}</span>
                  <span>•</span>
                  <span>{T("از", "from")} {r.ownerName}</span>
                  {pending && (
                    <>
                      <span>•</span>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1">{T("در انتظار", "Pending")}</Badge>
                    </>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1">
                <PIcon className="w-3 h-3" />
                {T(
                  r.permission === "view" ? "دیدن" : r.permission === "comment" ? "تعامل" : "ویرایش",
                  r.permission === "view" ? "View" : r.permission === "comment" ? "Interact" : "Edit",
                )}
              </Badge>

              {pending ? (
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => accept(r.id)} disabled={busy}>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => decline(r.id)} disabled={busy}>
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" asChild>
                  <Link to={meta.route(r.resource_id)}>{T("باز کردن", "Open")}</Link>
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
