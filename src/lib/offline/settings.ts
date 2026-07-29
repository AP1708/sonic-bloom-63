/** Smart-download preferences, stored locally on the device that downloads. */

const KEY = "sonance:smart-downloads";

export interface SmartDownloadSettings {
  enabled: boolean;
  /** Storage budget for the smart mix, in bytes. */
  limitBytes: number;
  /** Skip refreshes while the browser reports a metered / data-saver connection. */
  wifiOnly: boolean;
  /** Hours between automatic refreshes. */
  refreshHours: number;
  lastRunAt: number;
}

export const STORAGE_PRESETS = [
  { label: "500 MB", bytes: 500 * 1024 * 1024 },
  { label: "1 GB", bytes: 1024 * 1024 * 1024 },
  { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 },
  { label: "5 GB", bytes: 5 * 1024 * 1024 * 1024 },
];

export const DEFAULT_SETTINGS: SmartDownloadSettings = {
  enabled: false,
  limitBytes: 1024 * 1024 * 1024,
  wifiOnly: true,
  refreshHours: 12,
  lastRunAt: 0,
};

export function readSettings(): SmartDownloadSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SmartDownloadSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: SmartDownloadSettings): SmartDownloadSettings {
  if (typeof window === "undefined") return settings;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("sonance:smart-downloads"));
  } catch {
    /* private mode / quota — settings simply don't persist */
  }
  return settings;
}

/** True when the browser says the connection is metered or in data-saver mode. */
export function isMeteredConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as unknown as {
      connection?: { saveData?: boolean; type?: string; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  if (connection.type && connection.type !== "wifi" && connection.type !== "ethernet") return true;
  return connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
