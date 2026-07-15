import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PRIORITY_META, PRIORITY_ORDER, type Priority } from "@/lib/priority";
import type { TaskDefaults } from "@/lib/reminders";
import { RotateCcw } from "lucide-react";

type OnChange = (v: TaskDefaults) => void;

const DATE_OPTS: { key: NonNullable<TaskDefaults["default_date"]>; fa: string; en: string }[] = [
  { key: "none", fa: "بدون تاریخ", en: "No date" },
  { key: "today", fa: "امروز", en: "Today" },
  { key: "tomorrow", fa: "فردا", en: "Tomorrow" },
  { key: "next7", fa: "۷ روز آینده", en: "Next 7 days" },
];

const REMINDER_OPTS: { key: NonNullable<TaskDefaults["default_reminder"]>; fa: string; en: string }[] = [
  { key: "none", fa: "هیچ", en: "None" },
  { key: "ontime", fa: "سر موعد", en: "On time" },
  { key: "5min", fa: "۵ دقیقه قبل", en: "5 min before" },
  { key: "15min", fa: "۱۵ دقیقه قبل", en: "15 min before" },
  { key: "30min", fa: "۳۰ دقیقه قبل", en: "30 min before" },
  { key: "1hour", fa: "۱ ساعت قبل", en: "1 hour before" },
  { key: "2hours", fa: "۲ ساعت قبل", en: "2 hours before" },
  { key: "1day", fa: "۱ روز قبل", en: "1 day before" },
  { key: "2days", fa: "۲ روز قبل", en: "2 days before" },
];

const ADD_OPTS: { key: NonNullable<TaskDefaults["default_add_to"]>; fa: string; en: string }[] = [
  { key: "top", fa: "بالای لیست", en: "Top of list" },
  { key: "bottom", fa: "پایین لیست", en: "Bottom of list" },
];

const OVERDUE_OPTS: { key: NonNullable<TaskDefaults["overdue_position"]>; fa: string; en: string }[] = [
  { key: "top", fa: "بالای لیست", en: "Top of list" },
  { key: "bottom", fa: "پایین لیست", en: "Bottom of list" },
];

const DEFAULT_VALUE: Required<TaskDefaults> = {
  default_date: "none",
  default_reminder: "none",
  default_priority: "none",
  default_tag_id: null,
  default_folder_id: null,
  default_add_to: "top",
  overdue_position: "top",
};

interface Props {
  value: TaskDefaults;
  onChange: OnChange;
}

export function TaskDefaultSettings({ value, onChange }: Props) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);

  const [folders, setFolders] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("folders").select("id,name,parent_id").eq("user_id", user.id).order("position").then(({ data }) => {
      setFolders((data || []) as unknown as typeof folders);
    });
    supabase.from("tags").select("id,name,color").eq("user_id", user.id).order("name").then(({ data }) => {
      setTags((data || []) as unknown as typeof tags);
    });
  }, [user]);

  const patch = (next: Partial<TaskDefaults>) => {
    onChange({ ...value, ...next });
  };

  const reset = () => onChange({ ...DEFAULT_VALUE });

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0 border-border/40">
      <span className="text-sm">{label}</span>
      <div className="min-w-[140px]">{children}</div>
    </div>
  );

  return (
    <Card className="p-4 space-y-3 bg-card/60 border-border/60">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{T("پیش‌فرض تسک", "Task Default")}</h2>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs h-8">
          <RotateCcw className="w-3.5 h-3.5" /> {T("بازنشانی", "Reset")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-6">
        {T(
          "تنظیمات پیش‌فرض برای تسک‌هایی که از برنامه، ویجت یا اشتراک‌گذاری ساخته می‌شوند.",
          "Default settings for tasks created inside the app, from widgets, or shared from other apps.",
        )}
      </p>

      <Row label={T("تاریخ پیش‌فرض", "Default Date")}>
        <Select value={value.default_date || "none"} onValueChange={(v) => patch({ default_date: v as TaskDefaults["default_date"] })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_OPTS.map((o) => <SelectItem key={o.key} value={o.key} className="text-xs">{T(o.fa, o.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>

      <Row label={T("یادآور پیش‌فرض", "Default Reminder")}>
        <Select value={value.default_reminder || "none"} onValueChange={(v) => patch({ default_reminder: v as TaskDefaults["default_reminder"] })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REMINDER_OPTS.map((o) => <SelectItem key={o.key} value={o.key} className="text-xs">{T(o.fa, o.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>

      <Row label={T("اولویت پیش‌فرض", "Default Priority")}>
        <Select value={value.default_priority || "none"} onValueChange={(v) => patch({ default_priority: v as TaskDefaults["default_priority"] })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">{T("بدون اولویت", "No Priority")}</SelectItem>
            {PRIORITY_ORDER.map((p) => {
              const m = PRIORITY_META[p];
              return (
                <SelectItem key={p} value={p} className="text-xs">
                  <span className="flex items-center gap-1"><span>{m.emoji}</span> {m.label}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Row>

      <Row label={T("تگ پیش‌فرض", "Default Tag")}>
        <Select value={value.default_tag_id || "none"} onValueChange={(v) => patch({ default_tag_id: v === "none" ? null : v })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">{T("بدون تگ", "No Tags")}</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color || "hsl(var(--muted-foreground))" }} />
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label={T("لیست پیش‌فرض", "Default List")}>
        <Select value={value.default_folder_id || "none"} onValueChange={(v) => patch({ default_folder_id: v === "none" ? null : v })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">{T("اینباکس", "Inbox")}</SelectItem>
            {folders.filter((f) => !f.parent_id).map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label={T("افزودن به", "Default Add to")}>
        <Select value={value.default_add_to || "top"} onValueChange={(v) => patch({ default_add_to: v as TaskDefaults["default_add_to"] })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ADD_OPTS.map((o) => <SelectItem key={o.key} value={o.key} className="text-xs">{T(o.fa, o.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>

      <Row label={T("محل نمایش تسک‌های عقب‌افتاده", "Overdue Section shows at")}>
        <Select value={value.overdue_position || "top"} onValueChange={(v) => patch({ overdue_position: v as TaskDefaults["overdue_position"] })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {OVERDUE_OPTS.map((o) => <SelectItem key={o.key} value={o.key} className="text-xs">{T(o.fa, o.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Row>
    </Card>
  );
}
