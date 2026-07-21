import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CloudOff, CheckCircle2 } from "lucide-react";
import { getQueue, onQueueChange, flushQueue } from "@/lib/offlineQueue";
import { Button } from "@/components/ui/button";

const formatTime = (ts: number) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
  } catch {
    return "";
  }
};

export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem("arshnaz_last_sync");
      return v ? parseInt(v, 10) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    const refresh = async () => setPending((await getQueue()).length);
    refresh();
    const off = onQueueChange(refresh);
    const t = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
      off();
      clearInterval(t);
    };
  }, []);

  const sync = async () => {
    setSyncing(true);
    const { ok } = await flushQueue();
    setSyncing(false);
    if (ok > 0) {
      const now = Date.now();
      setLastSync(now);
      try {
        localStorage.setItem("arshnaz_last_sync", String(now));
      } catch { /* ignore */ }
    }
  };

  if (online && pending === 0 && !lastSync) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
      {!online ? (
        <>
          <WifiOff className="h-3.5 w-3.5 text-destructive" />
          <span>آفلاین — تغییرات ذخیره می‌شود</span>
        </>
      ) : pending > 0 ? (
        <>
          <CloudOff className="h-3.5 w-3.5 text-primary" />
          <span>{pending} تغییر در صف</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            disabled={syncing}
            onClick={sync}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>آنلاین{lastSync ? ` · آخرین همگام‌سازی ${formatTime(lastSync)}` : ""}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            disabled={syncing}
            onClick={sync}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        </>
      )}
    </div>
  );
}
