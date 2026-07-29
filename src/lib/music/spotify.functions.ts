import { createServerFn } from "@tanstack/react-start";
import type { Track } from "./types";
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
  searchSpotifyTracks,
  spotifyCredentials,
  type SpotifyTokens,
} from "./spotify.server";

interface SearchInput {
  query: string;
  limit?: number;
}

/** Public config the browser needs to start the PKCE flow. No secret included. */
export const getSpotifyConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ configured: boolean; clientId: string | null }> => {
    const creds = spotifyCredentials();
    return { configured: Boolean(creds), clientId: creds?.clientId ?? null };
  },
);

export const searchSpotify = createServerFn({ method: "GET" })
  .inputValidator((input: SearchInput) => ({
    query: String(input?.query ?? "").slice(0, 200),
    limit: Math.min(Math.max(Number(input?.limit ?? 20), 1), 50),
  }))
  .handler(async ({ data }): Promise<Track[]> => searchSpotifyTracks(data.query, data.limit));

export const exchangeSpotifyCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; codeVerifier: string; redirectUri: string }) => ({
    code: String(input?.code ?? ""),
    codeVerifier: String(input?.codeVerifier ?? ""),
    redirectUri: String(input?.redirectUri ?? ""),
  }))
  .handler(async ({ data }): Promise<SpotifyTokens> => exchangeAuthorizationCode(data));

export const refreshSpotifyToken = createServerFn({ method: "POST" })
  .inputValidator((input: { refreshToken: string }) => ({
    refreshToken: String(input?.refreshToken ?? ""),
  }))
  .handler(async ({ data }): Promise<SpotifyTokens> => refreshAccessToken(data.refreshToken));
