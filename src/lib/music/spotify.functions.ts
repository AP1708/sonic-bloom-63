import { createServerFn } from "@tanstack/react-start";
import type { Track } from "./types";
import { searchSpotifyTracks, spotifyCredentials } from "./spotify.server";


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

// The authorization-code exchange and refresh deliberately live in
// `connections.functions.ts` behind authentication: the refresh token is
// stored encrypted server-side and is never returned to the browser.

