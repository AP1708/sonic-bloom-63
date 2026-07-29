import {
  readConnection,
  saveConnection,
  type StoredTokens,
} from "./connections.server";

/**
 * Server-only Google OAuth + YouTube Data API helpers for per-listener accounts.
 * The Google client secret never leaves the server.
 */

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
].join(" ");

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export function googleCredentials(): GoogleCredentials | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const creds = googleCredentials();
  if (!creds) throw new Error("YouTube account linking is not configured yet.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function googleTokenRequest(body: URLSearchParams): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string;
}> {
  const creds = googleCredentials();
  if (!creds) throw new Error("YouTube account linking is not configured yet.");
  body.set("client_id", creds.clientId);
  body.set("client_secret", creds.clientSecret);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? "Google authorization failed.");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope ?? YOUTUBE_SCOPES,
  };
}

export function exchangeGoogleCode(code: string, redirectUri: string) {
  return googleTokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

export function refreshGoogleToken(refreshToken: string) {
  return googleTokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}

/** Returns a live YouTube access token for the user, refreshing when needed. */
export async function youtubeAccessToken(userId: string): Promise<string> {
  const row = await readConnection(userId, "youtube");
  if (!row) throw new Error("YouTube account is not connected.");
  if (row.tokens.expiresAt > Date.now() + 60_000) return row.tokens.accessToken;
  if (!row.tokens.refreshToken) {
    throw new Error("YouTube session expired — please reconnect your account.");
  }
  const refreshed = await refreshGoogleToken(row.tokens.refreshToken);
  const tokens: StoredTokens = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? row.tokens.refreshToken,
    expiresAt: refreshed.expiresAt,
  };
  await saveConnection({
    userId,
    provider: "youtube",
    accountLabel: row.accountLabel,
    scopes: row.scopes,
    tokens,
  });
  return tokens.accessToken;
}

async function ytFetch(
  token: string,
  path: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<any> {
  const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`YouTube API ${path} failed [${res.status}]: ${text}`);
    if (res.status === 403 && text.includes("quota")) {
      throw new Error("YouTube daily quota reached — try syncing again later.");
    }
    throw new Error(`YouTube request failed (${res.status}).`);
  }
  return text ? JSON.parse(text) : {};
}

export interface YtVideo {
  videoId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  /** playlistItem id, needed to remove items again */
  itemId?: string;
}

export async function fetchYouTubeChannelLabel(token: string): Promise<string | null> {
  const json = await ytFetch(token, "/channels", { query: { part: "snippet", mine: "true" } });
  return json.items?.[0]?.snippet?.title ?? null;
}

export async function fetchYouTubePlaylists(token: string) {
  const out: { id: string; title: string; description: string | null; artworkUrl: string | null }[] =
    [];
  let pageToken: string | undefined;
  do {
    const json = await ytFetch(token, "/playlists", {
      query: {
        part: "snippet",
        mine: "true",
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      },
    });
    for (const item of json.items ?? []) {
      out.push({
        id: item.id,
        title: item.snippet?.title ?? "Untitled playlist",
        description: item.snippet?.description || null,
        artworkUrl: item.snippet?.thumbnails?.high?.url ?? null,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken && out.length < 200);
  return out;
}

export async function fetchYouTubePlaylistItems(
  token: string,
  playlistId: string,
): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  let pageToken: string | undefined;
  do {
    const json = await ytFetch(token, "/playlistItems", {
      query: {
        part: "snippet,contentDetails",
        playlistId,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      },
    });
    for (const item of json.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;
      out.push({
        videoId,
        title: item.snippet?.title ?? "Unknown title",
        artist: item.snippet?.videoOwnerChannelTitle ?? "YouTube",
        artworkUrl: item.snippet?.thumbnails?.high?.url ?? null,
        itemId: item.id,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken && out.length < 500);
  return out.filter((v) => v.title !== "Deleted video" && v.title !== "Private video");
}

export async function fetchYouTubeLikedVideos(token: string): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  let pageToken: string | undefined;
  do {
    const json = await ytFetch(token, "/videos", {
      query: {
        part: "snippet",
        myRating: "like",
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      },
    });
    for (const item of json.items ?? []) {
      out.push({
        videoId: item.id,
        title: item.snippet?.title ?? "Unknown title",
        artist: item.snippet?.channelTitle ?? "YouTube",
        artworkUrl: item.snippet?.thumbnails?.high?.url ?? null,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken && out.length < 500);
  return out;
}

export async function createYouTubePlaylist(
  token: string,
  title: string,
  description: string | null,
): Promise<string> {
  const json = await ytFetch(token, "/playlists", {
    method: "POST",
    query: { part: "snippet,status" },
    body: JSON.stringify({
      snippet: { title, description: description ?? "Created with Sonance" },
      status: { privacyStatus: "private" },
    }),
  });
  return json.id as string;
}

export async function addVideoToYouTubePlaylist(
  token: string,
  playlistId: string,
  videoId: string,
) {
  await ytFetch(token, "/playlistItems", {
    method: "POST",
    query: { part: "snippet" },
    body: JSON.stringify({
      snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } },
    }),
  });
}

export async function removeYouTubePlaylistItem(token: string, itemId: string) {
  await ytFetch(token, "/playlistItems", { method: "DELETE", query: { id: itemId } });
}
