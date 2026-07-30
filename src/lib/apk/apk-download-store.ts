/**
 * Chunk store for resumable APK downloads (IndexedDB).
 *
 * A download is described by one manifest row plus N chunk blobs. Keeping the
 * chunks separate means a dropped connection only loses the in-flight chunk.
 */

const DB_NAME = "imusic-apk";
const DB_VERSION = 1;
const MANIFEST = "manifest";
const CHUNKS = "chunks";

/** 8 MB — big enough to be efficient, small enough that a drop costs little. */
export const CHUNK_SIZE = 8 * 1024 * 1024;

export interface ApkManifest {
  /** Stable key: release version. */
  id: string;
  url: string;
  fileName: string;
  totalBytes: number;
  etag: string | null;
  /** Indexes of chunks fully stored. */
  done: number[];
  chunkSize: number;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MANIFEST)) db.createObjectStore(MANIFEST, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open download storage"));
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = body(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Storage operation failed"));
      }),
  );
}

const chunkKey = (id: string, index: number) => `${id}:${index}`;

export async function readManifest(id: string): Promise<ApkManifest | null> {
  try {
    return (await tx<ApkManifest | undefined>(MANIFEST, "readonly", (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function writeManifest(manifest: ApkManifest): Promise<void> {
  await tx(MANIFEST, "readwrite", (s) => s.put({ ...manifest, updatedAt: Date.now() }));
}

export async function putChunk(id: string, index: number, blob: Blob): Promise<void> {
  await tx(CHUNKS, "readwrite", (s) => s.put(blob, chunkKey(id, index)));
}

export async function readChunk(id: string, index: number): Promise<Blob | null> {
  try {
    return (await tx<Blob | undefined>(CHUNKS, "readonly", (s) => s.get(chunkKey(id, index)))) ?? null;
  } catch {
    return null;
  }
}

/** Drops the manifest and every chunk for a download. */
export async function clearDownload(id: string): Promise<void> {
  const manifest = await readManifest(id);
  const total = manifest ? Math.ceil(manifest.totalBytes / manifest.chunkSize) : 0;
  for (let index = 0; index < total; index += 1) {
    try {
      await tx(CHUNKS, "readwrite", (s) => s.delete(chunkKey(id, index)));
    } catch {
      /* best effort */
    }
  }
  try {
    await tx(MANIFEST, "readwrite", (s) => s.delete(id));
  } catch {
    /* best effort */
  }
}

/** Removes stale manifests (and chunks) for versions other than the current one. */
export async function pruneOtherDownloads(keepId: string): Promise<void> {
  try {
    const ids = await tx<IDBValidKey[]>(MANIFEST, "readonly", (s) => s.getAllKeys());
    for (const id of ids) {
      if (typeof id === "string" && id !== keepId) await clearDownload(id);
    }
  } catch {
    /* best effort */
  }
}

/** Joins every stored chunk into one blob, in order. */
export async function assemble(manifest: ApkManifest, type: string): Promise<Blob> {
  const count = Math.ceil(manifest.totalBytes / manifest.chunkSize);
  const parts: Blob[] = [];
  for (let index = 0; index < count; index += 1) {
    const chunk = await readChunk(manifest.id, index);
    if (!chunk) throw new Error("A downloaded part went missing — restarting the download.");
    parts.push(chunk);
  }
  return new Blob(parts, { type });
}
