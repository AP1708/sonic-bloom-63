import {
  CHUNK_SIZE,
  assemble,
  clearDownload,
  putChunk,
  pruneOtherDownloads,
  readManifest,
  writeManifest,
  type ApkManifest,
} from "@/lib/apk/apk-download-store";

/**
 * Resumable APK downloader.
 *
 * Fetches the asset in ranged chunks through the same-origin proxy, persisting
 * every completed chunk. A dropped connection, a closed tab or an explicit
 * pause only costs the in-flight chunk: the next attempt resumes at the first
 * missing byte.
 */

export type ApkDownloadPhase =
  | "idle"
  | "preparing"
  | "downloading"
  | "paused"
  | "assembling"
  | "done"
  | "error";

export interface ApkProgress {
  phase: ApkDownloadPhase;
  receivedBytes: number;
  totalBytes: number;
  /** 0–1, or null while the total size is unknown. */
  ratio: number | null;
}

export const proxyUrl = (assetUrl: string) => `/api/public/apk?url=${encodeURIComponent(assetUrl)}`;

const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RangeUnsupportedError extends Error {}

interface Probe {
  totalBytes: number;
  etag: string | null;
  supportsRange: boolean;
  contentType: string;
}

async function probe(url: string, signal: AbortSignal): Promise<Probe> {
  // A 0-0 range probe answers "how big" and "do you support ranges" in one hop.
  const response = await fetch(proxyUrl(url), {
    headers: { Range: "bytes=0-0" },
    signal,
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Could not reach the download (HTTP ${response.status}).`);
  }
  await response.body?.cancel().catch(() => undefined);

  const contentType = response.headers.get("content-type") ?? "application/vnd.android.package-archive";
  const etag = response.headers.get("etag");
  const contentRange = response.headers.get("content-range");
  const acceptRanges = response.headers.get("accept-ranges");

  if (response.status === 206 && contentRange) {
    const total = Number(contentRange.split("/")[1]);
    if (Number.isFinite(total) && total > 0) {
      return { totalBytes: total, etag, supportsRange: true, contentType };
    }
  }

  const length = Number(response.headers.get("content-length") ?? "0");
  return {
    totalBytes: Number.isFinite(length) ? length : 0,
    etag,
    supportsRange: acceptRanges === "bytes",
    contentType,
  };
}

/** Reads the persisted progress for a release without starting anything. */
export async function peekProgress(id: string): Promise<ApkProgress | null> {
  const manifest = await readManifest(id);
  if (!manifest || !manifest.totalBytes) return null;
  const received = Math.min(manifest.done.length * manifest.chunkSize, manifest.totalBytes);
  if (received <= 0) return null;
  return {
    phase: received >= manifest.totalBytes ? "done" : "paused",
    receivedBytes: received,
    totalBytes: manifest.totalBytes,
    ratio: received / manifest.totalBytes,
  };
}

export interface RunOptions {
  id: string;
  url: string;
  fileName: string;
  signal: AbortSignal;
  onProgress: (progress: ApkProgress) => void;
  /** Fired the first time a resumed download picks up existing bytes. */
  onResumed?: (receivedBytes: number) => void;
}

/**
 * Runs (or resumes) the download and returns the finished file as a Blob.
 * Throws `RangeUnsupportedError` when the server can't serve partial content.
 */
export async function runResumableDownload(options: RunOptions): Promise<Blob> {
  const { id, url, fileName, signal, onProgress, onResumed } = options;

  onProgress({ phase: "preparing", receivedBytes: 0, totalBytes: 0, ratio: null });

  const info = await probe(url, signal);
  if (!info.totalBytes) throw new Error("The download size is unknown, so it can't be resumed.");
  if (!info.supportsRange) throw new RangeUnsupportedError("Server does not support range requests");

  await pruneOtherDownloads(id);

  let manifest = await readManifest(id);
  const stale =
    manifest &&
    (manifest.totalBytes !== info.totalBytes ||
      manifest.chunkSize !== CHUNK_SIZE ||
      (info.etag != null && manifest.etag != null && manifest.etag !== info.etag));
  if (stale) {
    await clearDownload(id);
    manifest = null;
  }

  if (!manifest) {
    manifest = {
      id,
      url,
      fileName,
      totalBytes: info.totalBytes,
      etag: info.etag,
      done: [],
      chunkSize: CHUNK_SIZE,
      updatedAt: Date.now(),
    } satisfies ApkManifest;
    await writeManifest(manifest);
  }

  const chunkCount = Math.ceil(manifest.totalBytes / manifest.chunkSize);
  const done = new Set(manifest.done);
  let received = Math.min(done.size * manifest.chunkSize, manifest.totalBytes);
  if (received > 0) onResumed?.(received);

  const emit = (phase: ApkDownloadPhase) =>
    onProgress({
      phase,
      receivedBytes: received,
      totalBytes: manifest!.totalBytes,
      ratio: received / manifest!.totalBytes,
    });

  emit("downloading");

  for (let index = 0; index < chunkCount; index += 1) {
    if (done.has(index)) continue;
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const start = index * manifest.chunkSize;
    const end = Math.min(start + manifest.chunkSize, manifest.totalBytes) - 1;

    let attempt = 0;
    for (;;) {
      try {
        const headers: Record<string, string> = { Range: `bytes=${start}-${end}` };
        if (info.etag) headers["If-Range"] = info.etag;
        const response = await fetch(proxyUrl(url), { headers, signal });
        if (response.status !== 206) {
          throw new RangeUnsupportedError(`Expected 206, got ${response.status}`);
        }
        const blob = await response.blob();
        await putChunk(id, index, blob);
        done.add(index);
        manifest = { ...manifest!, done: [...done].sort((a, b) => a - b) };
        await writeManifest(manifest);
        received = Math.min(done.size * manifest.chunkSize, manifest.totalBytes);
        emit("downloading");
        break;
      } catch (error) {
        if (signal.aborted || (error as Error)?.name === "AbortError") throw error;
        if (error instanceof RangeUnsupportedError) throw error;
        attempt += 1;
        if (attempt >= MAX_ATTEMPTS) throw error;
        // Backoff, then retry this chunk only — everything else stays on disk.
        await sleep(600 * attempt);
      }
    }
  }

  emit("assembling");
  const file = await assemble(manifest, info.contentType);
  await clearDownload(id);
  received = manifest.totalBytes;
  emit("done");
  return file;
}

/** Hands a finished blob to the browser as a file save. */
export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
