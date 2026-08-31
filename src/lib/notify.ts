import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const isNative = Capacitor.isNativePlatform();

function hashTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isNative) {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;
    if (status.display === "denied") return false;
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (isNative) {
    const status = await LocalNotifications.checkPermissions();
    return status.display === "granted";
  }
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function fireNotification(title: string, body: string, tag: string) {
  if (isNative) {
    LocalNotifications.schedule({
      notifications: [{ id: hashTag(tag), title, body }],
    }).catch(() => {
      /* ignore */
    });
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag, icon: "/icon-192.png" });
  } catch {
    /* ignore */
  }
}
