import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listTaskActivities, type TaskActivity } from "@/lib/taskActivity";
import { formatDistanceToNow } from "date-fns";
import { Loader2, History, Check, Plus, Trash2, Pin, Edit3, MapPin, FileText, Copy, Share2 } from "lucide-react";
import { toPersianDigits } from "@/lib/persianDigits";

const iconMap: Record<string, React.ReactNode> = {
  created: <Plus className="w-3.5 h-3.5" />,
  completed: <Check className="w-3.5 h-3.5" />,
  reopened: <History className="w-3.5 h-3.5" />,
  deleted: <Trash2 className="w-3.5 h-3.5" />,
  pinned: <Pin className="w-3.5 h-3.5" />,
  updated: <Edit3 className="w-3.5 h-3.5" />,
  location_set: <MapPin className="w-3.5 h-3.5" />,
  note_created: <FileText className="w-3.5 h-3.5" />,
  duplicated: <Copy className="w-3.5 h-3.5" />,
  shared: <Share2 className="w-3.5 h-3.5" />,
};

const defaultIcon = <History className="w-3.5 h-3.5" />;

export function TaskActivities({ taskId }: { taskId: string }) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const [items, setItems] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listTaskActivities(taskId)
      .then((data) => { if (mounted) setItems(data); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [taskId]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const relative = formatDistanceToNow(d, { addSuffix: true });
      return isEn ? relative : toPersianDigits(relative);
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {T("هنوز فعالیتی ثبت نشده.", "No activity yet.")}
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto py-1">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-3 text-sm">
          <div className="mt-0.5 text-muted-foreground shrink-0">{iconMap[a.action] || defaultIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{T(labelFa(a.action), labelEn(a.action))}</div>
            {a.payload && Object.keys(a.payload).length > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{JSON.stringify(a.payload)}</div>
            )}
            <div className="text-[11px] text-muted-foreground mt-0.5">{formatTime(a.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function labelFa(action: string) {
  const map: Record<string, string> = {
    created: "ساخته شد", completed: "تکمیل شد", reopened: "بازگشایی شد",
    deleted: "حذف شد", pinned: "پین تغییر کرد", updated: "ویرایش شد",
    location_set: "موقعیت تنظیم شد", note_created: "نوت ساخته شد",
    duplicated: "کپی شد", shared: "اشتراک‌گذاری شد", wont_do: "انجام نمی‌شود",
  };
  return map[action] || action;
}

function labelEn(action: string) {
  const map: Record<string, string> = {
    created: "Created", completed: "Completed", reopened: "Reopened",
    deleted: "Deleted", pinned: "Pin changed", updated: "Updated",
    location_set: "Location set", note_created: "Note created",
    duplicated: "Duplicated", shared: "Shared", wont_do: "Won't do",
  };
  return map[action] || action;
}
