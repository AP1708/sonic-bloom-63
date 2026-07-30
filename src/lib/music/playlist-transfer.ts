import type { Track } from "./types";
import { audioUrlFor } from "./catalog";

export interface PlaylistExport {
  format: "sonance.playlist";
  version: 1;
  title: string;
  description?: string | null;
  exportedAt: string;
  tracks: Array<{
    id: string;
    source: Track["source"];
    title: string;
    artist: string;
    artworkUrl?: string | null;
    durationSec: number;
  }>;
}

export function buildPlaylistExport(
  title: string,
  tracks: Track[],
  description?: string | null,
): PlaylistExport {
  return {
    format: "sonance.playlist",
    version: 1,
    title,
    description: description ?? null,
    exportedAt: new Date().toISOString(),
    tracks: tracks.map((t) => ({
      id: t.id,
      source: t.source,
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl ?? null,
      durationSec: t.durationSec,
    })),
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "playlist";
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadPlaylist(
  title: string,
  tracks: Track[],
  format: "json" | "csv" = "json",
  description?: string | null,
) {
  const base = slugify(title);
  if (format === "csv") {
    const rows = [
      ["title", "artist", "source", "track_id", "duration_sec"],
      ...tracks.map((t) => [t.title, t.artist, t.source, t.id, t.durationSec]),
    ];
    download(`${base}.csv`, "text/csv", rows.map((r) => r.map(csvCell).join(",")).join("\n"));
    return;
  }
  download(
    `${base}.json`,
    "application/json",
    JSON.stringify(buildPlaylistExport(title, tracks, description), null, 2),
  );
}

function toTrack(raw: Record<string, unknown>): Track | null {
  const id = String(raw.id ?? raw.track_id ?? "").trim();
  const title = String(raw.title ?? "").trim();
  if (!id || !title) return null;
  const rawSource = String(raw.source ?? "archive");
  const source: Track["source"] =
    rawSource === "spotify" ? "spotify" : rawSource === "youtube" ? "youtube" : "archive";
  return {
    id,
    source,
    title,
    artist: String(raw.artist ?? "Unknown artist"),
    artworkUrl: (raw.artworkUrl ?? raw.artwork_url ?? null) as string | null,
    durationSec: Number(raw.durationSec ?? raw.duration_sec ?? 0) || 0,
    audioUrl: audioUrlFor(id),
  };
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [] as Track[];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map((line) => {
      const cells = split(line);
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        row[h] = cells[i];
      });
      return toTrack(row);
    })
    .filter((t): t is Track => Boolean(t));
}

export interface ParsedImport {
  title: string;
  description: string | null;
  tracks: Track[];
}

/** Accepts a IMUSIC JSON export, a bare JSON array of tracks, or a CSV file. */
export function parsePlaylistFile(fileName: string, text: string): ParsedImport {
  const fallbackTitle = fileName.replace(/\.[^.]+$/, "") || "Imported playlist";
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const data = JSON.parse(trimmed);
    const list = Array.isArray(data) ? data : (data.tracks ?? []);
    if (!Array.isArray(list)) throw new Error("No tracks found in this file.");
    const tracks = list
      .map((raw: Record<string, unknown>) => toTrack(raw ?? {}))
      .filter((t: Track | null): t is Track => Boolean(t));
    if (!tracks.length) throw new Error("No valid tracks found in this file.");
    return {
      title: (!Array.isArray(data) && typeof data.title === "string" && data.title) || fallbackTitle,
      description: (!Array.isArray(data) && (data.description as string)) || null,
      tracks,
    };
  }
  const tracks = parseCsv(trimmed);
  if (!tracks.length) throw new Error("No valid tracks found in this file.");
  return { title: fallbackTitle, description: null, tracks };
}
