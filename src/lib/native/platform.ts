/**
 * Tiny helpers for telling the Capacitor Android shell apart from a browser.
 *
 * The native app loads the very same published site, so every feature works
 * unchanged — only a handful of flows (OAuth hand-off, system browser) need to
 * behave differently when we are inside the app.
 */

export const NATIVE_URL_SCHEME = "app.lovable.imusic";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True when running inside the packaged Android/iOS shell. */
export function isNativeApp(): boolean {
  const cap = capacitor();
  if (cap?.isNativePlatform?.()) return true;
  if (typeof navigator !== "undefined" && /IMUSICApp/i.test(navigator.userAgent)) return true;
  return false;
}

export function isNativeAndroid(): boolean {
  return isNativeApp() && (capacitor()?.getPlatform?.() ?? "android") === "android";
}
