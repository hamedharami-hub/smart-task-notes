import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);

    // Stale chunk after a new deploy — force a one-time hard reload so the
    // browser fetches the fresh index.html with current chunk hashes.
    const msg = String(error?.message || "");
    const isChunkError =
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /ChunkLoadError/i.test(msg) ||
      /Loading chunk [\w-]+ failed/i.test(msg);
    if (isChunkError) {
      try {
        const KEY = "__chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          Promise.resolve()
            .then(() =>
              "serviceWorker" in navigator
                ? navigator.serviceWorker
                    .getRegistrations()
                    .then((rs) => Promise.all(rs.map((r) => r.unregister())))
                    .catch(() => {})
                : undefined,
            )
            .then(() =>
              "caches" in window
                ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
                : undefined,
            )
            .finally(() => window.location.reload());
        }
      } catch {
        window.location.reload();
      }
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div dir="rtl" className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold">یک خطای غیرمنتظره رخ داد</h2>
            <p className="text-sm text-muted-foreground mt-1">
              نگران نباشید — داده‌های شما در امن است. می‌توانید این بخش را دوباره بارگذاری کنید.
            </p>
          </div>
          {this.state.error?.message && (
            <pre dir="ltr" className="text-xs text-start bg-muted/50 p-3 rounded border overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 me-2" /> تلاش مجدد
            </Button>
            <Button onClick={() => window.location.reload()} size="sm">
              بارگذاری کامل صفحه
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
