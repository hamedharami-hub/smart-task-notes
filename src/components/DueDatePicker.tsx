import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, X, Bell } from "lucide-react";
import { ensureNotificationPermission } from "@/lib/reminders";
import { toast } from "sonner";

import { addDays, format, startOfDay } from "date-fns";

/**
 * Compact smart due-date picker.
 * - Quick chips: امروز / فردا  + date input
 * - Toggle for time (with time field)
 * - Toggle for reminder (with datetime field)
 */
export function DueDatePicker({
  value,
  onChange,
  reminderValue = null,
  onReminderChange,
  label,
  compact = false,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  reminderValue?: string | null;
  onReminderChange?: (iso: string | null) => void;
  label?: string;
  compact?: boolean;
}) {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const labelText = label || T("سررسید", "Due date");
  const [datePart, setDatePart] = useState<string>("");
  const [timePart, setTimePart] = useState<string>("");
  const [includeTime, setIncludeTime] = useState<boolean>(false);
  const [reminderOn, setReminderOn] = useState<boolean>(!!reminderValue);

  useEffect(() => {
    if (!value) {
      setDatePart(""); setTimePart(""); setIncludeTime(false);
      return;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setDatePart(`${y}-${m}-${day}`);
    const isEndOfDayMarker = d.getHours() === 23 && d.getMinutes() === 59;
    setIncludeTime(!isEndOfDayMarker);
    setTimePart(isEndOfDayMarker ? "09:00" : `${h}:${mm}`);
  }, [value]);

  useEffect(() => { setReminderOn(!!reminderValue); }, [reminderValue]);

  const emit = (date: string, time: string, withTime: boolean) => {
    if (!date) { onChange(null); return; }
    const t = withTime && time ? time : "23:59";
    onChange(new Date(`${date}T${t}`).toISOString());
  };

  const setQuick = (offsetDays: number) => {
    const d = addDays(startOfDay(new Date()), offsetDays);
    const iso = format(d, "yyyy-MM-dd");
    setDatePart(iso);
    emit(iso, timePart || "09:00", includeTime);
  };

  const clear = () => {
    setDatePart(""); setTimePart(""); setIncludeTime(false);
    onChange(null);
    if (onReminderChange) { setReminderOn(false); onReminderChange(null); }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {labelText}
        </label>
      )}

      {/* Quick chips + date input on the same row */}
      <div className="flex gap-1.5 items-center flex-wrap">
        <Button
          type="button" size="sm"
          variant={isToday(datePart) ? "default" : "outline"}
          onClick={() => setQuick(0)} className="h-8 text-xs px-2"
        >{T("امروز", "Today")}</Button>
        <Button
          type="button" size="sm"
          variant={isTomorrow(datePart) ? "default" : "outline"}
          onClick={() => setQuick(1)} className="h-8 text-xs px-2"
        >{T("فردا", "Tomorrow")}</Button>
        <Input
          type="date" value={datePart}
          onChange={(e) => { setDatePart(e.target.value); emit(e.target.value, timePart, includeTime); }}
          className="h-8 flex-1 min-w-[130px] text-xs"
        />
        {value && (
          <Button type="button" size="icon" variant="ghost" onClick={clear} className="h-8 w-8" title={T("حذف", "Delete")}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Time toggle + time input on one row */}
      <div className="flex items-center gap-2">
        <Switch checked={includeTime} onCheckedChange={(v) => {
          setIncludeTime(v);
          if (datePart) emit(datePart, timePart || "09:00", v);
        }} id="due-time-toggle" />
        <label htmlFor="due-time-toggle" className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer flex-shrink-0">
          <Clock className="w-3 h-3" /> {T("ساعت", "Time")}
        </label>
        {includeTime && (
          <Input
            type="time" value={timePart || "09:00"}
            onChange={(e) => { setTimePart(e.target.value); emit(datePart, e.target.value, true); }}
            className="h-8 flex-1 text-xs"
          />
        )}
      </div>

      {/* Reminder (only when callback supplied) */}
      {onReminderChange && (
        <div className="flex items-center gap-2">
          <Switch
            checked={reminderOn}
            onCheckedChange={async (v) => {
              setReminderOn(v);
              if (!v) { onReminderChange(null); return; }
              const ok = await ensureNotificationPermission();
              if (!ok) toast.warning(T("اجازه‌ی نوتیفیکیشن داده نشده — یادآور صدا نمی‌زند", "Notification permission not granted — reminder won't sound"));
              if (datePart) {
                const t = includeTime && timePart ? timePart : "09:00";
                onReminderChange(new Date(`${datePart}T${t}`).toISOString());
              }
            }}
            id="reminder-toggle"
          />

          <label htmlFor="reminder-toggle" className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer flex-shrink-0">
            <Bell className="w-3 h-3" /> {T("یادآور", "Reminder")}
          </label>
          {reminderOn && (
            <Input
              type="datetime-local"
              value={reminderValue ? reminderValue.slice(0, 16) : ""}
              onChange={(e) => onReminderChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
              className="h-8 flex-1 text-xs"
            />
          )}
        </div>
      )}
    </div>
  );
}

function isToday(iso: string) {
  if (!iso) return false;
  return iso === format(startOfDay(new Date()), "yyyy-MM-dd");
}
function isTomorrow(iso: string) {
  if (!iso) return false;
  return iso === format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd");
}
