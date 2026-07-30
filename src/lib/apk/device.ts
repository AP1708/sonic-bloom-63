/**
 * Device/ABI detection for picking the right Android build.
 *
 * Android APKs are split per CPU architecture ("ABI"). Shipping the matching
 * split keeps the download far smaller than the universal build, which bundles
 * every architecture.
 */

export type Abi = "arm64-v8a" | "armeabi-v7a" | "x86_64" | "universal";

export const ABI_LABEL: Record<Abi, string> = {
  "arm64-v8a": "64-bit ARM (arm64-v8a)",
  "armeabi-v7a": "32-bit ARM (armeabi-v7a)",
  "x86_64": "Intel / x86_64",
  universal: "Universal (all devices)",
};

export const ABI_HINT: Record<Abi, string> = {
  "arm64-v8a": "Almost every phone from 2016 onwards.",
  "armeabi-v7a": "Older or budget 32-bit phones.",
  "x86_64": "Emulators, Chromebooks and Intel tablets.",
  universal: "Largest file — works on any device.",
};

/** Extracts the ABI encoded in a release asset file name. */
export function abiFromAssetName(name: string): Abi {
  const lower = name.toLowerCase();
  if (lower.includes("arm64-v8a") || lower.includes("arm64")) return "arm64-v8a";
  if (lower.includes("armeabi-v7a") || lower.includes("armv7")) return "armeabi-v7a";
  if (lower.includes("x86_64") || lower.includes("x8664")) return "x86_64";
  return "universal";
}

type UaDataLike = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string }>;
};

function fromUserAgentString(ua: string): Abi | null {
  const lower = ua.toLowerCase();
  if (!lower.includes("android")) return null;
  if (lower.includes("aarch64") || lower.includes("arm64")) return "arm64-v8a";
  if (lower.includes("x86_64") || lower.includes("x86-64")) return "x86_64";
  if (lower.includes("armv7") || lower.includes("armv8l")) return "armeabi-v7a";
  // Modern Android UA strings are frozen and carry no CPU info: arm64 is the
  // overwhelmingly common case, so it is the safest default.
  return "arm64-v8a";
}

/**
 * Best-effort guess of the visiting device's ABI.
 * Falls back to "universal" when the visitor isn't on Android.
 */
export async function detectAbi(): Promise<Abi> {
  if (typeof navigator === "undefined") return "universal";
  const uaData = (navigator as Navigator & { userAgentData?: UaDataLike }).userAgentData;

  if (uaData?.platform === "Android" && uaData.getHighEntropyValues) {
    try {
      const { architecture, bitness } = await uaData.getHighEntropyValues([
        "architecture",
        "bitness",
      ]);
      if (architecture === "arm") return bitness === "64" ? "arm64-v8a" : "armeabi-v7a";
      if (architecture === "x86" && bitness === "64") return "x86_64";
    } catch {
      /* fall through to UA sniffing */
    }
  }

  return fromUserAgentString(navigator.userAgent ?? "") ?? "universal";
}
