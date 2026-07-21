import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, UserPlus, Loader2, Eye, MessageSquare, Pencil, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { BidiText } from "@/components/BidiText";

export type ShareResourceType = "task" | "note" | "folder";
export type SharePermission = "view" | "comment" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resourceType: ShareResourceType;
  resourceId: string;
  resourceTitle?: string;
}

type Share = {
  id: string;
  recipient_email: string;
  recipient_id: string | null;
  permission: SharePermission;
  accepted_at: string | null;
  created_at: string;
  display_name?: string;
};

const emailSchema = z.string().trim().email().max(255).toLowerCase();

const PERM_META: Record<SharePermission, { icon: typeof Eye; label_fa: string; label_en: string; desc_fa: string; desc_en: string }> = {
  view:    { icon: Eye,          label_fa: "فقط دیدن",   label_en: "View only",     desc_fa: "می‌تواند ببیند ولی تغییر نمی‌دهد",        desc_en: "Can see but not change anything" },
  comment: { icon: MessageSquare,label_fa: "تعامل",       label_en: "Interact",      desc_fa: "می‌تواند تکمیل/زیرتسک اضافه کند",        desc_en: "Can complete and add subtasks" },
  edit:    { icon: Pencil,       label_fa: "ویرایش کامل", label_en: "Full edit",     desc_fa: "دسترسی کامل برای ویرایش",                desc_en: "Full edit access" },
};

function emailInitial(email: string) {
  return (email?.[0] || "?").toUpperCase();
}

export default function ShareDialog({ open, onOpenChange, resourceType, resourceId, resourceTitle }: Props) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState<SharePermission>("view");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!open || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shares")
      .select("id,recipient_email,recipient_id,permission,accepted_at,created_at")
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .order("created_at", { ascending: false })
      .returns<Share[]>();
    if (error) toast.error(error.message);

    const rows = (data as Share[] || []);
    const ids = Array.from(new Set(rows.map((s) => s.recipient_id).filter(Boolean)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      (profs || []).forEach((p: { id: string; display_name?: string | null }) => { names[p.id] = p.display_name || ""; });
    }
    setShares(rows.map((s) => ({ ...s, display_name: s.recipient_id ? names[s.recipient_id] : undefined })));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceType, resourceId, user]);

  const add = async () => {
    if (!user) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error(T("ایمیل نامعتبر", "Invalid email")); return; }
    if (parsed.data === (user.email || "").toLowerCase()) {
      toast.error(T("نمی‌توانی با خودت share کنی", "Can't share with yourself")); return;
    }
    setAdding(true);
    const { error } = await supabase.from("shares").insert({
      owner_id: user.id,
      recipient_email: parsed.data,
      resource_type: resourceType,
      resource_id: resourceId,
      permission: perm,
    });
    setAdding(false);
    if (error) {
      if (error.code === "23505") toast.error(T("این ایمیل قبلاً دعوت شده", "Already shared with this email"));
      else toast.error(error.message);
      return;
    }
    setEmail("");
    toast.success(T("اشتراک‌گذاری انجام شد ✓", "Shared successfully ✓"));
    load();
  };

  const updatePerm = async (id: string, newPerm: SharePermission) => {
    setShares((prev) => prev.map((s) => s.id === id ? { ...s, permission: newPerm } : s));
    const { error } = await supabase.from("shares").update({ permission: newPerm }).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const remove = async (id: string) => {
    setShares((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("shares").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success(T("اشتراک لغو شد", "Share revoked"));
    }
  };

  const resourceLabel = T(
    resourceType === "task" ? "تسک" : resourceType === "note" ? "نوت" : "فولدر",
    resourceType === "task" ? "task" : resourceType === "note" ? "note" : "folder",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {T(`اشتراک‌گذاری ${resourceLabel}`, `Share ${resourceLabel}`)}
          </DialogTitle>
          {resourceTitle && (
            <DialogDescription className="truncate">
              <BidiText text={resourceTitle} />
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="email"
              dir="ltr"
              placeholder={T("ایمیل شخص", "Person's email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              maxLength={255}
              className="flex-1"
            />
            <Button onClick={add} disabled={adding} size="sm">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>
          <Select value={perm} onValueChange={(v) => setPerm(v as SharePermission)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["view", "comment", "edit"] as SharePermission[]).map((p) => {
                const m = PERM_META[p];
                const Icon = m.icon;
                return (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" />
                      <div>
                        <div className="text-xs font-medium">{T(m.label_fa, m.label_en)}</div>
                        <div className="text-[10px] text-muted-foreground">{T(m.desc_fa, m.desc_en)}</div>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5">
          {loading && <div className="text-center py-4 text-xs text-muted-foreground">{T("در حال بارگذاری…", "Loading…")}</div>}
          {!loading && shares.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              {T("هنوز با کسی share نشده", "Not shared with anyone yet")}
            </div>
          )}
          {shares.map((s) => {
            const m = PERM_META[s.permission];
            const Icon = m.icon;
            return (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                <Avatar className="w-8 h-8 text-[10px]">
                  <AvatarFallback>{emailInitial(s.recipient_email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate" dir="ltr">{s.recipient_email}</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Icon className="w-2.5 h-2.5" />
                    {s.display_name || (s.accepted_at
                      ? T("پذیرفته شد", "Accepted")
                      : <Badge variant="outline" className="h-4 text-[9px] px-1">{T("در انتظار", "Pending")}</Badge>
                    )}
                  </div>
                </div>
                <Select value={s.permission} onValueChange={(v) => updatePerm(s.id, v as SharePermission)}>
                  <SelectTrigger className="h-7 w-24 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["view", "comment", "edit"] as SharePermission[]).map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        {T(PERM_META[p].label_fa, PERM_META[p].label_en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(s.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        {resourceType === "folder" && (
          <p className="text-[10px] text-muted-foreground">
            {T("اشتراک فولدر شامل تمام تسک‌ها و نوت‌های داخل آن نیز می‌شود.", "Sharing a folder also shares all tasks and notes inside it.")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
