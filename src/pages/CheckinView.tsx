import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import ProfileMicroPrompt from "@/components/ProfileMicroPrompt";
import { awardWaterDrops } from "@/lib/garden";

function Slider10({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div dir="rtl" className="space-y-2">
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="font-mono text-muted-foreground">{value ?? "—"}/10</span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-9 rounded text-xs font-medium transition ${
              value === n ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted-foreground/20"
            }`}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

export default function CheckinView() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({ mood: null, energy: null, focus: null, sleep_quality: null, stress: null, sleep_hours: "", notes: "" });
  const [history, setHistory] = useState<any[]>([]);
  const [savedTick, setSavedTick] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayLoad, setTodayLoad] = useState<number | null>(null);
  const isEvening = new Date().getHours() >= 17;

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    const [{ data: today_data }, { data: hist }, { data: tasks }] = await Promise.all([
      supabase.from("daily_checkins").select("*").eq("user_id", user!.id).eq("checkin_date", today).maybeSingle(),
      supabase.from("daily_checkins").select("*").eq("user_id", user!.id).gte("checkin_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).order("checkin_date"),
      supabase.from("tasks").select("id,title,description,priority,folder_id,quadrant").eq("user_id", user!.id).eq("completed", false),
    ]);
    if (today_data) setForm({
      mood: today_data.mood, energy: today_data.energy, focus: today_data.focus,
      sleep_quality: today_data.sleep_quality, stress: today_data.stress,
      sleep_hours: today_data.sleep_hours ?? "", notes: today_data.notes ?? "",
    });
    setHistory(hist || []);
    const { computeCognitiveLoad } = await import("@/lib/cognitiveLoad");
    const r = computeCognitiveLoad({
      tasks: tasks || [],
      sleepHours: today_data?.sleep_hours ?? null,
      sleepQuality: today_data?.sleep_quality ?? null,
      stress: today_data?.stress ?? null,
    });
    setTodayLoad(r.load);
    setLoading(false);
  }


  async function save() {
    if (!user) return;
    const payload: any = {
      user_id: user.id,
      checkin_date: today,
      mood: form.mood, energy: form.energy, focus: form.focus,
      sleep_quality: form.sleep_quality, stress: form.stress,
      sleep_hours: form.sleep_hours ? Number(form.sleep_hours) : null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from("daily_checkins").upsert(payload, { onConflict: "user_id,checkin_date" });
    if (error) toast.error(error.message);
    else {
      awardWaterDrops(20, "ثبت چک‌این روزانه");
      toast.success("ثبت شد ✨");
      setSavedTick(Date.now());
      load();
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      {savedTick && <ProfileMicroPrompt trigger={`checkin-${savedTick}`} />}
      <div>
        <h1 className="text-3xl font-bold mb-2">Check-in روزانه</h1>
        <p className="text-muted-foreground text-sm">ثبت کوتاه روزانه برای الگویابی بلندمدت.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">امروز · {today}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <Slider10 label="خلق" value={form.mood} onChange={(v) => setForm({ ...form, mood: v })} />
          <Slider10 label="انرژی" value={form.energy} onChange={(v) => setForm({ ...form, energy: v })} />
          <Slider10 label="تمرکز" value={form.focus} onChange={(v) => setForm({ ...form, focus: v })} />
          <Slider10 label="کیفیت خواب دیشب" value={form.sleep_quality} onChange={(v) => setForm({ ...form, sleep_quality: v })} />
          <Slider10 label="استرس" value={form.stress} onChange={(v) => setForm({ ...form, stress: v })} />
          <div className="space-y-2">
            <Label>ساعات خواب</Label>
            <input
              type="number" step="0.5" min="0" max="14"
              value={form.sleep_hours}
              onChange={(e) => setForm({ ...form, sleep_hours: e.target.value })}
              className="w-32 h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="مثلاً 7.5"
            />
          </div>
          {/* A2 — Dynamic evening reflection: appears in evening + when load was high */}
          {isEvening && todayLoad != null && todayLoad >= 12 && (
            <div className="border-s-4 border-amber-500 bg-amber-500/5 rounded-md p-3 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                🌙 تأمل شبانه — بار شناختی امروز <span className="tabular-nums">{todayLoad}</span> بود
              </div>
              <div className="space-y-2">
                <Label className="text-xs">سخت‌ترین بخش امروز چه بود؟</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="یک نکته کوتاه بنویس..."
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                💡 با ثبت این تأمل، الگوی بار شناختی هفته بعد دقیق‌تر می‌شود.
              </p>
            </div>
          )}
          {(!isEvening || todayLoad == null || todayLoad < 12) && (
            <div className="space-y-2">
              <Label>یادداشت کوتاه</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="چه چیزی امروز قابل توجه بود؟" rows={3} />
            </div>
          )}
          <Button onClick={save} className="w-full">ذخیره</Button>
        </CardContent>
      </Card>

      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">روند ۳۰ روز اخیر</CardTitle>
            <CardDescription>خلق، انرژی، تمرکز</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history.map((h) => ({ date: h.checkin_date.slice(5), mood: h.mood, energy: h.energy, focus: h.focus }))}>
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 10]} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="energy" stroke="hsl(var(--chart-2, 200 70% 50%))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="focus" stroke="hsl(var(--chart-3, 30 80% 55%))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
