export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export async function hasNotificationPermission(): Promise<boolean> {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function fireNotification(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag, icon: "/pwa-192x192.png" });
  } catch {
    /* ignore */
  }
}
