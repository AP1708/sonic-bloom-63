import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics/events";
import { clearDownload } from "@/lib/apk/apk-download-store";
import {
  RangeUnsupportedError,
  peekProgress,
  runResumableDownload,
  saveBlob,
  type ApkDownloadPhase,
  type ApkProgress,
} from "@/lib/apk/apk-download";

export interface ApkRelease {
  version: string;
  apkUrl: string;
  apkName: string;
  sizeBytes: number;
}

const IDLE: ApkProgress = { phase: "idle", receivedBytes: 0, totalBytes: 0, ratio: null };

/**
 * Drives a resumable APK download and exposes everything the UI needs:
 * phase, byte counts, and start / pause / resume / cancel controls.
 */
export function useApkDownload(release: ApkRelease | null) {
  const [progress, setProgress] = useState<ApkProgress>(IDLE);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const id = release?.version ?? null;

  // Surface any partial download left over from a previous visit.
  useEffect(() => {
    let cancelled = false;
    setProgress(IDLE);
    setError(null);
    if (!id) return;
    void peekProgress(id).then((existing) => {
      if (!cancelled && existing) setProgress(existing);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Abort any in-flight transfer if the component unmounts.
  useEffect(() => () => controller.current?.abort(), []);

  const openInstallPage = useCallback(() => {
    const url = "/download#install";
    if (window.location.pathname === "/download") {
      window.location.hash = "install";
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.assign(url);
    }
  }, []);

  // Best-effort OS-level notification once the file is ready.
  const notifyComplete = useCallback(
    (version: string) => {
      if (typeof Notification === "undefined") return;
      const show = () => {
        try {
          const notification = new Notification("IMUSIC APK downloaded", {
            body: `v${version} is ready to install. Tap for install steps.`,
            icon: "/icons/icon-192.png",
            tag: "imusic-apk-download",
          });
          notification.onclick = () => {
            window.focus();
            openInstallPage();
            notification.close();
          };
        } catch {
          /* notifications unsupported in this context */
        }
      };
      if (Notification.permission === "granted") show();
      else if (Notification.permission === "default") {
        void Notification.requestPermission().then((result) => {
          if (result === "granted") show();
        });
      }
    },
    [openInstallPage],
  );

  const fallbackToBrowser = useCallback((url: string) => {
    // Range unsupported: let the browser handle it the old way so nobody is stuck.
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, []);


  const start = useCallback(async () => {
    if (!release) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError(null);

    const resuming = progress.receivedBytes > 0;
    track({
      event: resuming ? "apk_download_resume" : "apk_download_start",
      category: "offline",
      source: "stream",
      status: "ok",
      meta: { version: release.version, receivedBytes: progress.receivedBytes },
    });

    try {
      const blob = await runResumableDownload({
        id: release.version,
        url: release.apkUrl,
        fileName: release.apkName,
        signal: abort.signal,
        onProgress: setProgress,
      });
      saveBlob(blob, release.apkName);
      track({
        event: "apk_download_complete",
        category: "offline",
        source: "stream",
        status: "ok",
        meta: { version: release.version, bytes: blob.size },
      });
      toast.success("APK downloaded", { description: `IMUSIC v${release.version} is ready to install.` });
    } catch (caught) {
      if (abort.signal.aborted || (caught as Error)?.name === "AbortError") {
        setProgress((current) =>
          current.phase === "downloading" ? { ...current, phase: "paused" } : current,
        );
        return;
      }
      if (caught instanceof RangeUnsupportedError) {
        track({
          event: "apk_download_failed",
          category: "offline",
          source: "stream",
          status: "degraded",
          reason: "range_unsupported",
          meta: { version: release.version },
        });
        toast.info("Resuming isn't available for this file", {
          description: "Starting a normal browser download instead.",
        });
        fallbackToBrowser(release.apkUrl);
        setProgress(IDLE);
        return;
      }
      const message = caught instanceof Error ? caught.message : "The download stopped unexpectedly.";
      setError(message);
      setProgress((current) => ({ ...current, phase: "error" }));
      track({
        event: "apk_download_failed",
        category: "offline",
        source: "stream",
        status: "error",
        reason: message.slice(0, 180),
        meta: { version: release.version, receivedBytes: progress.receivedBytes },
      });
      toast.error("Download interrupted", {
        description: "Your progress is saved — tap Resume to continue.",
      });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, [release, progress.receivedBytes, fallbackToBrowser]);

  const pause = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setProgress((current) => ({ ...current, phase: "paused" }));
  }, []);

  const cancel = useCallback(async () => {
    controller.current?.abort();
    controller.current = null;
    if (id) await clearDownload(id);
    setProgress(IDLE);
    setError(null);
  }, [id]);

  const phase: ApkDownloadPhase = progress.phase;
  const active = phase === "preparing" || phase === "downloading" || phase === "assembling";
  const percent = progress.ratio == null ? null : Math.min(100, Math.round(progress.ratio * 100));

  return {
    progress,
    phase,
    percent,
    active,
    resumable: !active && progress.receivedBytes > 0 && phase !== "done",
    error,
    start,
    pause,
    cancel,
  };
}
