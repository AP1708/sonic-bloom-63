import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteConnection,
  listConnectionSummaries,
  readConnection,
  saveConnection,
} from "@/lib/music/connections.server";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchYouTubeChannelLabel,
  googleCredentials,
} from "@/lib/music/youtube-account.server";
import { fetchSpotifyProfileName, spotifyUserSession } from "@/lib/music/spotify-account.server";
import { exchangeAuthorizationCode } from "@/lib/music/spotify.server";

import {
  importSpotifyLibrary,
  importYouTubeLibrary,
  pushPlaylistToYouTube,
} from "@/lib/music/library-sync.server";

/** Whether YouTube account linking has been configured on the server. */
export const getYouTubeAuthConfig = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(googleCredentials()),
}));

export const listMyConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listConnectionSummaries(context.userId));

/**
 * Completes the browser PKCE flow server-side.
 *
 * The authorization code is exchanged here, the refresh token is stored
 * encrypted against the signed-in user, and only the short-lived access token
 * (what the Web Playback SDK needs) is returned to the browser.
 */
export const connectSpotifyWithCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; codeVerifier: string; redirectUri: string }) => ({
    code: String(input?.code ?? ""),
    codeVerifier: String(input?.codeVerifier ?? ""),
    redirectUri: String(input?.redirectUri ?? ""),
  }))
  .handler(async ({ data, context }) => {
    if (!data.code || !data.codeVerifier) throw new Error("Missing Spotify authorization code.");
    const tokens = await exchangeAuthorizationCode(data);
    const expiresAt = Date.now() + tokens.expiresInSec * 1000;
    const label = await fetchSpotifyProfileName(tokens.accessToken).catch(() => null);
    await saveConnection({
      userId: context.userId,
      provider: "spotify",
      accountLabel: label,
      scopes: tokens.scope,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      },
    });
    return { accessToken: tokens.accessToken, expiresAt, accountLabel: label };
  });

/**
 * Mints a fresh short-lived Spotify access token from the encrypted refresh
 * token held server-side, so the browser never has to keep one.
 */
export const mintSpotifyAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const session = await spotifyUserSession(context.userId);
    return { accessToken: session.accessToken, expiresAt: session.expiresAt };
  });


export const startYouTubeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectUri: string; state: string }) => ({
    redirectUri: String(input?.redirectUri ?? ""),
    state: String(input?.state ?? ""),
  }))
  .handler(async ({ data }) => ({
    authorizationUrl: buildGoogleAuthUrl(data.redirectUri, data.state),
  }));

export const completeYouTubeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; redirectUri: string }) => ({
    code: String(input?.code ?? ""),
    redirectUri: String(input?.redirectUri ?? ""),
  }))
  .handler(async ({ data, context }) => {
    if (!data.code) throw new Error("Google did not return an authorization code.");
    const tokens = await exchangeGoogleCode(data.code, data.redirectUri);
    const label = await fetchYouTubeChannelLabel(tokens.accessToken).catch(() => null);
    const existing = await readConnection(context.userId, "youtube").catch(() => null);
    await saveConnection({
      userId: context.userId,
      provider: "youtube",
      accountLabel: label,
      scopes: tokens.scope,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? existing?.tokens.refreshToken ?? null,
        expiresAt: tokens.expiresAt,
      },
    });
    return { ok: true, accountLabel: label };
  });

export const disconnectMusicAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: "spotify" | "youtube" }) => ({
    provider: input?.provider === "youtube" ? ("youtube" as const) : ("spotify" as const),
  }))
  .handler(async ({ data, context }) => {
    await deleteConnection(context.userId, data.provider);
    return { ok: true };
  });

export const importMusicLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: "spotify" | "youtube" }) => ({
    provider: input?.provider === "youtube" ? ("youtube" as const) : ("spotify" as const),
  }))
  .handler(async ({ data, context }) =>
    data.provider === "youtube"
      ? importYouTubeLibrary(context.userId)
      : importSpotifyLibrary(context.userId),
  );

export const syncPlaylistToYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playlistId: string }) => ({
    playlistId: String(input?.playlistId ?? ""),
  }))
  .handler(async ({ data, context }) => pushPlaylistToYouTube(context.userId, data.playlistId));
