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
import { fetchSpotifyProfileName } from "@/lib/music/spotify-account.server";
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

export const linkSpotifyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      accessToken: string;
      refreshToken: string | null;
      expiresAt: number;
      scope: string;
    }) => ({
      accessToken: String(input?.accessToken ?? ""),
      refreshToken: input?.refreshToken ? String(input.refreshToken) : null,
      expiresAt: Number(input?.expiresAt ?? 0),
      scope: String(input?.scope ?? ""),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.accessToken) throw new Error("Missing Spotify access token.");
    const label = await fetchSpotifyProfileName(data.accessToken).catch(() => null);
    await saveConnection({
      userId: context.userId,
      provider: "spotify",
      accountLabel: label,
      scopes: data.scope,
      tokens: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
    return { ok: true, accountLabel: label };
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
