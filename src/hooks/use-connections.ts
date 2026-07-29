import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  disconnectMusicAccount,
  getYouTubeAuthConfig,
  importMusicLibrary,
  listMyConnections,
  startYouTubeConnect,
} from "@/lib/music/connections.functions";
import { useSession } from "@/hooks/use-session";

export type ConnectionProvider = "spotify" | "youtube";

const STATE_KEY = "sonance.youtube.state";
const RETURN_KEY = "sonance.youtube.return";

/** Linked provider accounts for the signed-in listener. */
export function useMusicConnections() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["music-connections", user?.id],
    queryFn: () => listMyConnections(),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
}

export function useYouTubeAuthConfig() {
  return useQuery({
    queryKey: ["youtube-auth-config"],
    queryFn: () => getYouTubeAuthConfig(),
    staleTime: Infinity,
  });
}

/** Sends the listener to Google's consent screen for YouTube access. */
export function useConnectYouTube() {
  return useCallback(async () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
    const { authorizationUrl } = await startYouTubeConnect({
      data: { redirectUri: `${window.location.origin}/youtube/callback`, state },
    });
    const target = window.top ?? window;
    target.location.href = authorizationUrl;
  }, []);
}

export function useImportLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: ConnectionProvider) => importMusicLibrary({ data: { provider } }),
    onSuccess: (summary, provider) => {
      toast.success(
        `Imported ${summary.playlists} playlist${summary.playlists === 1 ? "" : "s"} and ${summary.liked} liked song${summary.liked === 1 ? "" : "s"} from ${provider === "youtube" ? "YouTube" : "Spotify"}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["liked-songs"] });
      queryClient.invalidateQueries({ queryKey: ["music-connections"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Import failed."),
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: ConnectionProvider) => disconnectMusicAccount({ data: { provider } }),
    onSuccess: (_data, provider) => {
      toast.success(`${provider === "youtube" ? "YouTube" : "Spotify"} account disconnected.`);
      queryClient.invalidateQueries({ queryKey: ["music-connections"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not disconnect."),
  });
}
