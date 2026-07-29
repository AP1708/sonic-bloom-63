import { readConnection, saveConnection, type StoredTokens } from "./connections.server";
import { refreshAccessToken } from "./spotify.server";

/** Server-only Spotify Web API calls made on behalf of a linked listener. */

export async function spotifyUserToken(userId: string): Promise<string> {
  const row = await readConnection(userId, "spotify");
  if (!row) throw new Error("Spotify account is not connected.");
  if (row.tokens.expiresAt > Date.now() + 60_000) return row.tokens.accessToken;
  if (!row.tokens.refreshToken) {
    throw new Error("Spotify session expired — please reconnect your account.");
  }
  const refreshed = await refreshAccessToken(row.tokens.refreshToken);
  const tokens: StoredTokens = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? row.tokens.refreshToken,
    expiresAt: Date.now() + refreshed.expiresInSec * 1000,
  };
  await saveConnection({
    userId,
    provider: "spotify",
    accountLabel: row.accountLabel,
    scopes: row.scopes,
    tokens,
  });
  return tokens.accessToken;
}

async function spFetch(token: string, url: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Spotify API ${url} failed [${res.status}]: ${text}`);
    if (res.status === 401) throw new Error("Spotify session expired — please reconnect.");
    if (res.status === 429) throw new Error("Spotify rate limit reached — try again shortly.");
    throw new Error(`Spotify request failed (${res.status}).`);
  }
  return text ? JSON.parse(text) : {};
}

export async function fetchSpotifyProfileName(token: string): Promise<string | null> {
  const json = await spFetch(token, "https://api.spotify.com/v1/me");
  return json.display_name ?? json.id ?? null;
}

export interface SpTrack {
  trackId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationSec: number;
  externalId: string;
}

function mapItem(track: any): SpTrack | null {
  if (!track?.id) return null;
  return {
    trackId: `sp-${track.id}`,
    title: track.name ?? "Unknown title",
    artist: (track.artists ?? []).map((a: any) => a.name).join(", ") || "Unknown artist",
    artworkUrl: track.album?.images?.[0]?.url ?? null,
    durationSec: Math.round((track.duration_ms ?? 0) / 1000),
    externalId: track.id,
  };
}

export async function fetchSpotifyPlaylists(token: string) {
  const out: { id: string; title: string; description: string | null; artworkUrl: string | null }[] =
    [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
  while (url && out.length < 200) {
    const json: any = await spFetch(token, url);
    for (const item of json.items ?? []) {
      if (!item?.id) continue;
      out.push({
        id: item.id,
        title: item.name ?? "Untitled playlist",
        description: item.description || null,
        artworkUrl: item.images?.[0]?.url ?? null,
      });
    }
    url = json.next ?? null;
  }
  return out;
}

export async function fetchSpotifyPlaylistTracks(
  token: string,
  playlistId: string,
): Promise<SpTrack[]> {
  const out: SpTrack[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  while (url && out.length < 500) {
    const json: any = await spFetch(token, url);
    for (const row of json.items ?? []) {
      const mapped = mapItem(row?.track);
      if (mapped) out.push(mapped);
    }
    url = json.next ?? null;
  }
  return out;
}

export async function fetchSpotifySavedTracks(token: string): Promise<SpTrack[]> {
  const out: SpTrack[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
  while (url && out.length < 500) {
    const json: any = await spFetch(token, url);
    for (const row of json.items ?? []) {
      const mapped = mapItem(row?.track);
      if (mapped) out.push(mapped);
    }
    url = json.next ?? null;
  }
  return out;
}
