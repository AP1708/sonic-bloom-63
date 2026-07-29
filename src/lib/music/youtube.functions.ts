import { createServerFn } from "@tanstack/react-start";
import type { Track } from "./types";

/**
 * YouTube Data API v3 search, executed server-side so the API keys never
 * reach the browser. Only metadata is fetched; playback happens in the
 * official IFrame player (required by YouTube's terms).
 *
 * Multiple keys (from different Google Cloud projects) are supported so the
 * search can hop to the next key when one exhausts its daily quota.
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

/** Distinguishes "this key is out of quota" from a genuine key/config problem. */
function isQuotaError(status: number, body: string): boolean {
  return status === 429 || (status === 403 && /quota|rateLimit|RESOURCE_EXHAUSTED/i.test(body));
}

export const searchYouTube = createServerFn({ method: "GET" })
  .inputValidator((input: SearchInput) => ({
    query: String(input?.query ?? "").slice(0, 200),
    limit: Math.min(Math.max(Number(input?.limit ?? 20), 1), 50),
  }))
  .handler(async ({ data }): Promise<Track[]> => {
    const {
      cacheKey,
      readCache,
      writeCache,
      writeQuotaMiss,
      dedupe,
      apiKeys,
      availableApiKeys,
      markKeyExhausted,
      innertubeSearch,
    } = await import("./youtube.server");

    if (!data.query.trim()) return [];

    const key = cacheKey(data.query, data.limit);
    const cached = readCache(key);
    if (cached) return cached;

    // No project key configured at all: keyless web search still works.
    if (!apiKeys().length) {
      return dedupe(key, async () => {
        try {
          const tracks = await innertubeSearch(data.query, data.limit);
          writeCache(key, tracks);
          return tracks;
        } catch (error) {
          console.error(`YouTube keyless search failed: ${(error as Error).message}`);
          writeQuotaMiss(key);
          return [];
        }
      });
    }

    return dedupe(key, async () => {
      const keys = availableApiKeys();

      let lastError: Error | null = null;

      for (const apiKey of keys) {
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
          if (isQuotaError(searchRes.status, body)) {
            // Park this key until the daily reset and try the next project's key.
            markKeyExhausted(apiKey);
            lastError = new Error("YouTube quota exceeded");
            continue;
          }
          if (searchRes.status === 400 || searchRes.status === 403) {
            // Bad/restricted key — skip it, another key may still work.
            lastError = new Error(
              "YouTube rejected the API key — check that it is valid and that YouTube Data API v3 is enabled.",
            );
            continue;
          }
          lastError = new Error(`YouTube search failed (${searchRes.status})`);
          continue;
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
        if (!items.length) {
          writeCache(key, []);
          return [];
        }

        // Second call: durations (not returned by search). Reuse the same key;
        // a failure here only costs us duration metadata.
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

        const tracks = items.map((item) => {
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
        writeCache(key, tracks);
        return tracks;
      }

      // Every key failed (usually the 100-search/day quota). Fall back to
      // YouTube's own keyless web search so playback keeps working.
      console.error(`YouTube search exhausted all ${keys.length} key(s): ${lastError?.message}`);
      try {
        const { innertubeSearch } = await import("./youtube.server");
        const tracks = await innertubeSearch(data.query, data.limit);
        if (tracks.length) {
          writeCache(key, tracks);
          return tracks;
        }
      } catch (error) {
        console.error(`YouTube keyless fallback failed: ${(error as Error).message}`);
      }
      writeQuotaMiss(key);
      return [];

    });
  });
