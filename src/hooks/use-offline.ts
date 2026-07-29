import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getAudioBlob,
  keepTrack,
  listOffline,
  removeTrack,
  saveTrack,
  storageEstimate,
  subscribeOffline,
  type OfflineEntry,
} from "@/lib/offline/store";
import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type SmartDownloadSettings,
} from "@/lib/offline/settings";
import { runSmartDownloads, type SmartDownloadProgress } from "@/lib/offline/smart-downloads";
import { useListeningHistory } from "@/hooks/use-listening-history";
import { useLikedSongs } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";
import type { Track } from "@/lib/music/types";

/** Everything the UI needs about downloads: the list, settings, and refreshing. */
export function useOffline() {
  const { user } = useSession();
  const [entries, setEntries] = useState<OfflineEntry[]>([]);
  const [settings, setSettings] = useState<SmartDownloadSettings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<SmartDownloadProgress>({
    phase: "idle",
    completed: 0,
    total: 0,
  });
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);

  const { data: history } = useListeningHistory(user?.id);
  const { data: liked } = useLikedSongs(user?.id);

  const refreshList = useCallback(() => {
    void listOffline().then(setEntries);
    void storageEstimate().then(setEstimate);
  }, []);

  useEffect(() => {
    setSettings(readSettings());
    refreshList();
    const unsubscribe = subscribeOffline(refreshList);
    const onSettings = () => setSettings(readSettings());
    window.addEventListener("sonance:smart-downloads", onSettings);
    return () => {
      unsubscribe();
      window.removeEventListener("sonance:smart-downloads", onSettings);
    };
  }, [refreshList]);

  const update = useCallback((patch: Partial<SmartDownloadSettings>) => {
    setSettings((prev) => writeSettings({ ...prev, ...patch }));
  }, []);

  const download = useCallback(async (track: Track) => {
    setBusyIds((prev) => [...prev, track.id]);
    try {
      const entry = await saveTrack(track, "manual");
      toast.success(
        entry.hasAudio
          ? `“${track.title}” is available offline`
          : `“${track.title}” pinned — this source has to stream`,
      );
    } catch {
      toast.error("Couldn't save that track for offline use.");
    } finally {
      setBusyIds((prev) => prev.filter((id) => id !== track.id));
    }
  }, []);

  const remove = useCallback(async (trackId: string) => {
    await removeTrack(trackId);
  }, []);

  const runningRef = useRef(false);
  const refreshMix = useCallback(
    async (options?: { silent?: boolean }) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const result = await runSmartDownloads({
          history: history ?? [],
          liked: liked ?? [],
          settings: readSettings(),
          onProgress: setProgress,
        });
        update({ lastRunAt: Date.now() });
        if (options?.silent) return;
        if (result.skipped) toast(result.skipped);
        else if (result.added || result.removed) {
          toast.success(`Offline mix refreshed — ${result.added} added, ${result.removed} retired`);
        } else toast("Your offline mix is already up to date");
      } finally {
        runningRef.current = false;
        setProgress({ phase: "idle", completed: 0, total: 0 });
      }
    },
    [history, liked, update],
  );

  const smart = useMemo(() => entries.filter((entry) => entry.reason === "smart"), [entries]);
  const manual = useMemo(() => entries.filter((entry) => entry.reason === "manual"), [entries]);
  const usedBytes = useMemo(() => entries.reduce((sum, entry) => sum + entry.bytes, 0), [entries]);

  return {
    entries,
    smart,
    manual,
    usedBytes,
    estimate,
    settings,
    update,
    progress,
    busyIds,
    download,
    remove,
    keep: keepTrack,
    refreshMix,
    ready: Boolean(history || liked),
  };
}

/** Ids of everything stored offline — used for badges in track lists. */
export function useOfflineIds() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const load = () => void listOffline().then((entries) => setIds(new Set(entries.map((e) => e.id))));
    load();
    return subscribeOffline(load);
  }, []);
  return ids;
}

/**
 * Resolves a stored audio blob into a playable object URL, revoking it when the
 * track changes so memory doesn't leak across a long listening session.
 */
export function useOfflineAudioUrl(trackId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!trackId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void getAudioBlob(trackId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      setUrl(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [trackId]);
  return url;
}
