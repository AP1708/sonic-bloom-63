import { createServerFn } from "@tanstack/react-start";
import type { Track } from "./types";

/**
 * YouTube Data API v3 search, executed server-side so the API key never
 * reaches the browser. Only metadata is fetched; playback happens in the
 * official IFrame player (required by YouTube's terms).
 */

interface SearchInput {
  query: string;
  limit?: number;
}

function parseIsoDuration(value: string): number {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  if (!match) return 0;
  const [, d, h, m, s] = match;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)
  );
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** "Artist - Title (Official Video)" → { artist, title } */
function splitTitle(raw: string, channel: string): { title: string; artist: string } {
  const clean = decodeEntities(raw)
    .replace(/\s*[\(\[][^\)\]]*(official|video|audio|lyric|hd|4k|remaster)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*\|\s*.*$/, "")
    .trim();
  const parts = clean.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { title: clean, artist: decodeEntities(channel).replace(/\s*-\s*Topic$/i, "").trim() };
}

export const searchYouTube = createServerFn({ method: "GET" })
  .inputValidator((input: SearchInput) => ({
    query: String(input?.query ?? "").slice(0, 200),
    limit: Math.min(Math.max(Number(input?.limit ?? 20), 1), 50),
  }))
  .handler(async ({ data }): Promise<Track[]> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YouTube is not configured yet.");
    if (!data.query.trim()) return [];

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoCategoryId", "10"); // Music
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("maxResults", String(data.limit));
    searchUrl.searchParams.set("q", data.query);
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const body = await searchRes.text();
      console.error(`YouTube search failed [${searchRes.status}]: ${body}`);
      if (searchRes.status === 400 || searchRes.status === 403) {
        throw new Error(
          "YouTube rejected the API key — check that it is valid and that YouTube Data API v3 is enabled.",
        );
      }
      throw new Error(`YouTube search failed (${searchRes.status})`);
    }
    const searchJson = (await searchRes.json()) as {
      items?: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails?: Record<string, { url: string }>;
        };
      }[];
    };

    const items = (searchJson.items ?? []).filter((item) => item.id?.videoId);
    if (!items.length) return [];

    // Second call: durations (not returned by search).
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "contentDetails");
    detailsUrl.searchParams.set("id", items.map((item) => item.id.videoId).join(","));
    detailsUrl.searchParams.set("key", apiKey);

    const durations = new Map<string, number>();
    const detailsRes = await fetch(detailsUrl);
    if (detailsRes.ok) {
      const detailsJson = (await detailsRes.json()) as {
        items?: { id: string; contentDetails?: { duration?: string } }[];
      };
      for (const item of detailsJson.items ?? []) {
        durations.set(item.id, parseIsoDuration(item.contentDetails?.duration ?? ""));
      }
    }

    return items.map((item) => {
      const videoId = item.id.videoId;
      const { title, artist } = splitTitle(item.snippet.title, item.snippet.channelTitle);
      const thumbs = item.snippet.thumbnails ?? {};
      return {
        id: `yt-${videoId}`,
        source: "youtube" as const,
        title,
        artist: artist || "YouTube",
        artworkUrl: (thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null,
        durationSec: durations.get(videoId) ?? 0,
        audioUrl: null,
        youtubeVideoId: videoId,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    });
  });
