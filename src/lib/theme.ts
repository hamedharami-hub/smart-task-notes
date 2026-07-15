export type AppTheme = "system" | "light" | "dark" | "ticktick-light" | "arshnaz-light" | "arshnaz-dark";

const THEME_KEY = "arshnaz-theme";

export function applyTheme(t: AppTheme | string | null | undefined) {
  const root = document.documentElement;
  if (!t) {
    root.classList.remove("theme-arshnaz", "theme-ticktick");
    return;
  }
  root.classList.remove("theme-arshnaz", "theme-ticktick");
  if (t === "arshnaz-light") {
    root.classList.add("theme-arshnaz");
    root.classList.remove("dark");
  } else if (t === "arshnaz-dark") {
    root.classList.add("theme-arshnaz");
    root.classList.add("dark");
  } else if (t === "ticktick-light") {
    root.classList.add("theme-ticktick");
    root.classList.remove("dark");
  } else if (t === "dark") {
    root.classList.add("dark");
  } else if (t === "light") {
    root.classList.remove("dark");
  } else if (t === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
}

export function getStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
