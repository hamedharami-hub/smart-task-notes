// Offline-first mutation queue using IndexedDB.
// Queues Supabase mutations while offline and replays them when back online.

import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

type QueuedOp = {
  id?: number;
  table: string;
  op: "insert" | "update" | "delete" | "upsert";
  payload?: unknown;
  match?: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  nextRetryAt?: number;
};

const DB_NAME = "taskflow-offline";
const STORE = "outbox";
const CACHE_STORE = "cache";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOp(op: Omit<QueuedOp, "id" | "createdAt" | "attempts" | "nextRetryAt">) {
  const db = await getDB();
  await db.add(STORE, { ...op, createdAt: Date.now(), attempts: 0 });
  notifyChange();
  if (typeof navigator !== "undefined" && navigator.onLine) {
    // try to flush immediately; if it fails, retry loop will pick it up
    setTimeout(() => flushQueue(), 50);
  }
}

export async function getQueue(): Promise<QueuedOp[]> {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function getPendingOps(table?: string): Promise<QueuedOp[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return table ? all.filter((op) => op.table === table) : all;
}

export async function clearQueue() {
  const db = await getDB();
  await db.clear(STORE);
  notifyChange();
}

export async function cacheSet(key: string, value: unknown) {
  const db = await getDB();
  await db.put(CACHE_STORE, value, key);
}

export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(CACHE_STORE, key) as Promise<T | undefined>;
}

const listeners = new Set<() => void>();
export function onQueueChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notifyChange() {
  listeners.forEach((l) => l());
}

let syncing = false;
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (syncing || !navigator.onLine) return { ok: 0, failed: 0 };
  syncing = true;
  let ok = 0;
  let failed = 0;
  try {
    const db = await getDB();
    const items = await db.getAll(STORE);
    const now = Date.now();
    for (const item of items) {
      if (item.nextRetryAt && item.nextRetryAt > now) continue;
      try {
        const q = (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(item.table);
        let res;
        if (item.op === "insert") {
          res = await q.insert(item.payload as Record<string, unknown>);
        } else if (item.op === "upsert") {
          res = await q.upsert(item.payload as Record<string, unknown>);
        } else if (item.op === "update") {
          let b = q.update(item.payload as Record<string, unknown>);
          for (const [k, v] of Object.entries(item.match || {})) b = b.eq(k, v);
          res = await b;
        } else if (item.op === "delete") {
          let b = q.delete();
          for (const [k, v] of Object.entries(item.match || {})) b = b.eq(k, v);
          res = await b;
        }
        if (res?.error) throw res.error;
        await db.delete(STORE, item.id!);
        ok++;
      } catch (e) {
        failed++;
        item.attempts++;
        const backoff = Math.min(2 ** item.attempts * 1000, 30000);
        item.nextRetryAt = Date.now() + backoff;
        if (item.attempts >= 5) {
          // give up after 5 attempts to avoid infinite retry
          await db.delete(STORE, item.id!);
        } else {
          await db.put(STORE, item);
        }
      }
    }
  } finally {
    syncing = false;
    notifyChange();
  }
  return { ok, failed };
}

export function initOfflineSync() {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    flushQueue();
  });

  // try once on startup
  if (navigator.onLine) {
    setTimeout(() => flushQueue(), 1500);
  }

  // periodic retry — the queue itself skips items that are not due yet
  setInterval(() => {
    if (navigator.onLine) flushQueue();
  }, 15_000);
}
