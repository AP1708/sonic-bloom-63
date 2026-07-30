import type { Track } from "@/lib/music/types";

/**
 * Offline store (IndexedDB).
 *
 * Holds saved track metadata plus, when the source allows it, the actual audio
 * bytes. Only public-domain archive recordings carry a direct stream we are
 * allowed to keep locally — Spotify and YouTube entries are pinned as metadata
 * so they show up and queue instantly, but their audio still streams.
 */

const DB_NAME = "sonance-offline";
const DB_VERSION = 1;
const TRACKS = "tracks";
const AUDIO = "audio";

export type OfflineReason = "manual" | "smart";

export interface OfflineEntry {
  id: string;
  track: Track;
  reason: OfflineReason;
  savedAt: number;
  bytes: number;
  /** False for streaming-only sources (Spotify / YouTube). */
  hasAudio: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACKS)) db.createObjectStore(TRACKS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(AUDIO)) db.createObjectStore(AUDIO);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage"));
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function run<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  body: (stores: IDBObjectStore[]) => IDBRequest<T> | null,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx = db.transaction(names, mode);
        const request = body(names.map((name) => tx.objectStore(name)));
        if (!request) {
          tx.oncomplete = () => resolve(null);
          tx.onerror = () => reject(tx.error);
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

// --- change notifications ---------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOffline(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

// --- reads ------------------------------------------------------------------

export async function listOffline(): Promise<OfflineEntry[]> {
  try {
    const rows = (await run<OfflineEntry[]>(TRACKS, "readonly", ([store]) =>
      store.getAll() as IDBRequest<OfflineEntry[]>,
    )) as OfflineEntry[] | null;
    return (rows ?? []).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function getAudioBlob(trackId: string): Promise<Blob | null> {
  try {
    const blob = await run<Blob>(AUDIO, "readonly", ([store]) => store.get(trackId) as IDBRequest<Blob>);
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function usageBytes(): Promise<number> {
  const entries = await listOffline();
  return entries.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
}

/** Browser-reported quota, useful for showing headroom in the UI. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/** Ask the browser not to evict our downloads under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// --- writes -----------------------------------------------------------------

async function putEntry(entry: OfflineEntry, blob: Blob | null) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([TRACKS, AUDIO], "readwrite");
    tx.objectStore(TRACKS).put(entry);
    if (blob) tx.objectStore(AUDIO).put(blob, entry.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

/**
 * Saves a track for offline use. Archive tracks are fully downloaded; other
 * sources are pinned as metadata only.
 *
 * `onBytes` reports download progress; `total` is 0 when the server doesn't
 * send a content-length. Throws when a real audio URL exists but the fetch
 * fails, so callers can mark the item failed instead of silently pinning it.
 */
export async function saveTrack(
  track: Track,
  reason: OfflineReason = "manual",
  signal?: AbortSignal,
  onBytes?: (received: number, total: number) => void,
): Promise<OfflineEntry> {
  const url = track.audioUrl ?? null;
  let blob: Blob | null = null;
  if (url) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const total = Number(response.headers.get("content-length") ?? 0);
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value as unknown as BlobPart);
          received += value.byteLength;
          onBytes?.(received, total);
        }
      }
      blob = new Blob(chunks, { type: response.headers.get("content-type") ?? "audio/mpeg" });
    } else {
      blob = await response.blob();
      onBytes?.(blob.size, total || blob.size);
    }
  }
  const entry: OfflineEntry = {
    id: track.id,
    track,
    reason,
    savedAt: Date.now(),
    bytes: blob?.size ?? 0,
    hasAudio: Boolean(blob),
  };
  await putEntry(entry, blob);
  return entry;
}


export async function removeTrack(trackId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([TRACKS, AUDIO], "readwrite");
    tx.objectStore(TRACKS).delete(trackId);
    tx.objectStore(AUDIO).delete(trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

export async function clearReason(reason: OfflineReason): Promise<void> {
  const entries = await listOffline();
  for (const entry of entries.filter((item) => item.reason === reason)) {
    await removeTrack(entry.id);
  }
}

/**
 * Trims the store down to `limitBytes`, dropping the oldest auto-managed items
 * first. Manual downloads are only touched when nothing else is left.
 */
export async function pruneTo(limitBytes: number): Promise<void> {
  const entries = await listOffline();
  let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= limitBytes) return;
  const order = [
    ...entries.filter((entry) => entry.reason === "smart").sort((a, b) => a.savedAt - b.savedAt),
    ...entries.filter((entry) => entry.reason === "manual").sort((a, b) => a.savedAt - b.savedAt),
  ];
  for (const entry of order) {
    if (total <= limitBytes) break;
    await removeTrack(entry.id);
    total -= entry.bytes;
  }
}

/** Promotes an auto-downloaded track to a manual keep (never auto-deleted). */
export async function keepTrack(trackId: string): Promise<void> {
  const entries = await listOffline();
  const entry = entries.find((item) => item.id === trackId);
  if (!entry || entry.reason === "manual") return;
  await putEntry({ ...entry, reason: "manual" }, null);
}
