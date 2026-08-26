/**
 * Keeps the browser/PWA status bar (theme-color) perfectly in sync with the
 * app header background, so the notification bar blends with the app UI.
 */

function ensureMeta(): HTMLMetaElement {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  return meta;
}

function resolveHeaderColor(): string {
  const styles = getComputedStyle(document.documentElement);
  // Header uses bg-card/50 over the page background -> background is the visible tone.
  const bg = styles.getPropertyValue("--background").trim();
  if (bg) return `hsl(${bg})`;
  return "#0F172A";
}

export function syncStatusBarTheme() {
  try {
    const meta = ensureMeta();
    const color = resolveHeaderColor();
    if (meta.content !== color) meta.content = color;
    // Remove media-scoped duplicates so ours always wins.
    document
      .querySelectorAll('meta[name="theme-color"][media]')
      .forEach((el) => el.parentElement?.removeChild(el));

    // If Capacitor StatusBar plugin is available
    const cap = (window as any).Capacitor;
    if (cap?.isPluginAvailable?.("StatusBar")) {
      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme")?.includes("dark") ||
        window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const StatusBar = cap.Plugins?.StatusBar;
      if (StatusBar) {
        StatusBar.setStyle({ style: isDark ? "DARK" : "LIGHT" }).catch(() => {});
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      }
    }
  } catch {
    /* noop */
  }
}

export function initStatusBarTheme() {
  syncStatusBarTheme();
  const observer = new MutationObserver(() => syncStatusBarTheme());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", syncStatusBarTheme);
}
