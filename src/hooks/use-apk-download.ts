import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics/events";
import { clearDownload } from "@/lib/apk/apk-download-store";
import {
  ChecksumMismatchError,
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
  /** Published SHA-256 (hex) for this build, when the release notes list one. */
  sha256?: string | null;
}

const IDLE: ApkProgress = { phase: "idle", receivedBytes: 0, totalBytes: 0, ratio: null };

/** Smoothing factor for the rolling speed estimate. */
const SPEED_ALPHA = 0.3;
/** Ignore samples closer together than this (ms) — they're too noisy. */
const SAMPLE_MIN_MS = 400;

/**
 * Drives a resumable APK download and exposes everything the UI needs:
 * phase, byte counts, live speed / time remaining, and start / pause /
 * resume / cancel controls.
 */
export function useApkDownload(release: ApkRelease | null) {
  const [progress, setProgress] = useState<ApkProgress>(IDLE);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [verified, setVerified] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sample = useRef<{ at: number; bytes: number } | null>(null);
  const askedPermission = useRef(false);
  const id = release?.version ?? null;

  // Surface any partial download left over from a previous visit.
  useEffect(() => {
    let cancelled = false;
    setProgress(IDLE);
    setError(null);
    setSpeed(null);
    setCompleted(false);
    setVerified(false);
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

  /** Ask up front (on the user's click) so the completion notice can appear. */
  const ensureNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    if (askedPermission.current) return false;
    askedPermission.current = true;
    try {
      return (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }, []);

  // Best-effort OS-level notification once the file is verified and ready.
  const notifyComplete = useCallback(
    (version: string) => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
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

  /** Updates progress and keeps a smoothed bytes-per-second estimate. */
  const handleProgress = useCallback((next: ApkProgress) => {
    setProgress(next);
    if (next.phase !== "downloading") {
      if (next.phase !== "assembling" && next.phase !== "verifying") setSpeed(null);
      sample.current = null;
      return;
    }
    const now = Date.now();
    const previous = sample.current;
    if (!previous) {
      sample.current = { at: now, bytes: next.receivedBytes };
      return;
    }
    const elapsed = now - previous.at;
    if (elapsed < SAMPLE_MIN_MS) return;
    const delta = next.receivedBytes - previous.bytes;
    sample.current = { at: now, bytes: next.receivedBytes };
    if (delta <= 0) return;
    const instant = (delta / elapsed) * 1000;
    setSpeed((current) => (current == null ? instant : current + SPEED_ALPHA * (instant - current)));
  }, []);

  const start = useCallback(async () => {
    if (!release) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError(null);
    setCompleted(false);
    setVerified(false);
    setSpeed(null);
    sample.current = null;

    // Ask while we still have the user's click gesture.
    await ensureNotificationPermission();

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
        onProgress: handleProgress,
        expectedSha256: release.sha256 ?? null,
      });
      saveBlob(blob, release.apkName);
      setCompleted(true);
      setVerified(Boolean(release.sha256));
      setSpeed(null);
      track({
        event: "apk_download_complete",
        category: "offline",
        source: "stream",
        status: "ok",
        meta: { version: release.version, bytes: blob.size, verified: Boolean(release.sha256) },
      });
      toast.success("APK downloaded", {
        description: release.sha256
          ? `IMUSIC v${release.version} verified and ready to install.`
          : `IMUSIC v${release.version} is ready to install.`,
        duration: 10000,
        action: { label: "Open install page", onClick: openInstallPage },
      });
      notifyComplete(release.version);
    } catch (caught) {
      setSpeed(null);
      if (abort.signal.aborted || (caught as Error)?.name === "AbortError") {
        setProgress((current) =>
          current.phase === "downloading" ? { ...current, phase: "paused" } : current,
        );
        return;
      }
      if (caught instanceof ChecksumMismatchError) {
        setProgress({ ...IDLE, phase: "error" });
        setError(
          "The downloaded file didn't match the official checksum, so it was discarded. Please try again.",
        );
        track({
          event: "apk_download_failed",
          category: "offline",
          source: "stream",
          status: "error",
          reason: "checksum_mismatch",
          meta: { version: release.version },
        });
        toast.error("Download couldn't be verified", {
          description: "The file didn't match the official checksum — it was removed. Try again.",
        });
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
  }, [
    release,
    progress.receivedBytes,
    fallbackToBrowser,
    notifyComplete,
    openInstallPage,
    handleProgress,
    ensureNotificationPermission,
  ]);

  const pause = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    sample.current = null;
    setSpeed(null);
    setProgress((current) => ({ ...current, phase: "paused" }));
  }, []);

  const cancel = useCallback(async () => {
    controller.current?.abort();
    controller.current = null;
    sample.current = null;
    if (id) await clearDownload(id);
    setProgress(IDLE);
    setError(null);
    setSpeed(null);
    setCompleted(false);
    setVerified(false);
  }, [id]);

  const phase: ApkDownloadPhase = progress.phase;
  const active =
    phase === "preparing" || phase === "downloading" || phase === "assembling" || phase === "verifying";
  const percent = progress.ratio == null ? null : Math.min(100, Math.round(progress.ratio * 100));

  const remaining =
    phase === "downloading" && speed && progress.totalBytes > progress.receivedBytes
      ? (progress.totalBytes - progress.receivedBytes) / speed
      : null;

  return {
    progress,
    phase,
    percent,
    active,
    /** Smoothed bytes per second, or null when not measurable. */
    speed,
    /** Estimated seconds left, or null. */
    remainingSeconds: remaining,
    completed,
    verified,
    openInstallPage,
    resumable: !active && progress.receivedBytes > 0 && phase !== "done",
    error,
    start,
    pause,
    cancel,
  };
}
