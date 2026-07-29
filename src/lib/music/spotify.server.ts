import type { Track } from "./types";

/**
 * Server-only Spotify Web API helpers. The client id/secret never leave the
 * server; the browser only ever receives track metadata or a user access token
 * that Spotify itself issued for that user.
 */

interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

export function spotifyCredentials(): SpotifyCredentials | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

let appToken: { value: string; expiresAt: number } | null = null;

/** Client-credentials token, used for public catalogue search. Cached in memory. */
async function getAppToken(creds: SpotifyCredentials): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 30_000) return appToken.value;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      body.error_description ??
        "Spotify rejected the app credentials — check the Client ID and Client Secret.",
    );
  }
  appToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return appToken.value;
}

interface SpotifyApiTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  external_urls?: { spotify?: string };
  artists?: { name: string }[];
  album?: { name?: string; images?: { url: string }[] };
}

export function mapSpotifyTrack(item: SpotifyApiTrack): Track {
  return {
    id: `sp-${item.id}`,
    source: "spotify",
    title: item.name,
    artist: (item.artists ?? []).map((a) => a.name).join(", ") || "Unknown artist",
    album: item.album?.name,
    artworkUrl: item.album?.images?.[0]?.url ?? null,
    durationSec: Math.round((item.duration_ms ?? 0) / 1000),
    audioUrl: null,
    previewUrl: item.preview_url,
    spotifyUri: item.uri,
    externalUrl: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
  };
}

export async function searchSpotifyTracks(query: string, limit: number): Promise<Track[]> {
  const creds = spotifyCredentials();
  if (!creds) throw new Error("Spotify is not configured yet.");
  if (!query.trim()) return [];

  const token = await getAppToken(creds);
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 20;
  url.searchParams.set("limit", String(safeLimit));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify search failed [${res.status}]: ${text}`);
    if (res.status === 401 || res.status === 403) {
      appToken = null;
      throw new Error("Spotify rejected the credentials — check the Client ID and Secret.");
    }
    if (res.status === 429) throw new Error("Spotify rate limit reached — try again shortly.");
    throw new Error(`Spotify search failed (${res.status})`);
  }
  const json = (await res.json()) as { tracks?: { items?: SpotifyApiTrack[] } };
  return (json.tracks?.items ?? []).filter(Boolean).map(mapSpotifyTrack);
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
  scope: string;
}

async function tokenRequest(body: URLSearchParams): Promise<SpotifyTokens> {
  const creds = spotifyCredentials();
  if (!creds) throw new Error("Spotify is not configured yet.");
  body.set("client_id", creds.clientId);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}`,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? "Spotify authorization failed.");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresInSec: json.expires_in ?? 3600,
    scope: json.scope ?? "",
  };
}

/** Authorization Code + PKCE exchange (the secret stays here, on the server). */
export function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<SpotifyTokens> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}
