import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Lyrics lookup for catalog tracks (including the Indian public-domain archive).
 *
 * Source: LRCLIB (https://lrclib.net) — a free, community-maintained lyrics
 * database with both plain and time-synced lyrics. Runs server-side so the
 * browser never hits CORS and responses can be cached by the query client.
 *
 * Archive filenames often carry extra tokens (composer, chorus credits, film
 * name), so we try progressively shorter title variants before giving up.
 */

export interface LyricLine {
  timeSec: number | null;
  text: string;
}

export interface LyricsResult {
  status: "synced" | "plain" | "none";
  lines: LyricLine[];
  provider: string | null;
  matchedTitle: string | null;
  matchedArtist: string | null;
}

const NONE: LyricsResult = {
  status: "none",
  lines: [],
  provider: null,
  matchedTitle: null,
  matchedArtist: null,
};

const NOISE =
  /\b(chorus|remastered|remaster|rare|original|version|mono|hd|hq|full|song|audio|lyrics|film|movie)\b/gi;

function normaliseTitle(raw: string) {
  return raw
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(NOISE, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleVariants(raw: string) {
  const base = normaliseTitle(raw);
  const words = base.split(" ").filter(Boolean);
  const variants = new Set<string>();
  if (base) variants.add(base);
  for (const size of [6, 5, 4, 3]) {
    if (words.length > size) variants.add(words.slice(0, size).join(" "));
  }
  return [...variants];
}

function parseSynced(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of lrc.split("\n")) {
    const stamps = [...row.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, "").trim();
    if (!stamps.length) continue;
    for (const stamp of stamps) {
      const minutes = Number(stamp[1]);
      const seconds = Number(stamp[2]);
      const fraction = stamp[3] ? Number(`0.${stamp[3]}`) : 0;
      lines.push({ timeSec: minutes * 60 + seconds + fraction, text });
    }
  }
  return lines.sort((a, b) => (a.timeSec ?? 0) - (b.timeSec ?? 0));
}

function parsePlain(text: string): LyricLine[] {
  return text
    .split("\n")
    .map((row) => ({ timeSec: null, text: row.trim() }))
    .filter((row, index, all) => row.text || (all[index - 1]?.text ?? "") !== "");
}

interface LrclibRecord {
  trackName?: string;
  artistName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

function toResult(record: LrclibRecord | undefined): LyricsResult | null {
  if (!record) return null;
  if (record.syncedLyrics?.trim()) {
    const lines = parseSynced(record.syncedLyrics);
    if (lines.length) {
      return {
        status: "synced",
        lines,
        provider: "LRCLIB",
        matchedTitle: record.trackName ?? null,
        matchedArtist: record.artistName ?? null,
      };
    }
  }
  if (record.plainLyrics?.trim()) {
    return {
      status: "plain",
      lines: parsePlain(record.plainLyrics),
      provider: "LRCLIB",
      matchedTitle: record.trackName ?? null,
      matchedArtist: record.artistName ?? null,
    };
  }
  return null;
}

async function lrclibJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`https://lrclib.net/api/${path}`, {
      headers: {
        "User-Agent": "Sonance (https://lovable.dev)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const fetchLyrics = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        title: z.string().min(1).max(200),
        artist: z.string().min(1).max(120),
        durationSec: z.number().int().min(0).max(7200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<LyricsResult> => {
    const artist = data.artist.trim();

    for (const title of titleVariants(data.title)) {
      // Exact-signature lookup first (best match quality).
      const exact = toResult(
        (await lrclibJson(
          `get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}` +
            (data.durationSec ? `&duration=${data.durationSec}` : ""),
        )) as LrclibRecord | undefined,
      );
      if (exact) return exact;

      // Then a fuzzy search across the database.
      const found = (await lrclibJson(
        `search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      )) as LrclibRecord[] | null;
      if (Array.isArray(found)) {
        for (const record of found.slice(0, 5)) {
          const result = toResult(record);
          if (result) return result;
        }
      }
    }

    return NONE;
  });
