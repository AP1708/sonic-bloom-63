import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSpotifyConfig } from "@/lib/music/spotify.functions";
import {
  beginSpotifyLogin,
  disconnectSpotify,
  readSession,
  type SpotifySession,
} from "@/lib/music/spotify-auth";
import { spotifyPlayback, type SpotifyPlayerStatus } from "@/lib/music/spotify-playback";

/** Tracks whether the listener has linked their own Spotify account. */
export function useSpotifyConnection() {
  const [session, setSession] = useState<SpotifySession | null>(null);
  const [status, setStatus] = useState<SpotifyPlayerStatus>(spotifyPlayback.status);
  const [error, setError] = useState<string | null>(spotifyPlayback.error);

  useEffect(() => {
    setSession(readSession());
    const sync = () => setSession(readSession());
    window.addEventListener("sonance:spotify-session", sync);
    window.addEventListener("storage", sync);
    spotifyPlayback.onStatusChange = () => {
      setStatus(spotifyPlayback.status);
      setError(spotifyPlayback.error);
    };
    return () => {
      window.removeEventListener("sonance:spotify-session", sync);
      window.removeEventListener("storage", sync);
      spotifyPlayback.onStatusChange = null;
    };
  }, []);

  const config = useQuery({
    queryKey: ["spotify-config"],
    queryFn: () => getSpotifyConfig(),
    staleTime: Infinity,
  });

  const connect = useCallback(async () => {
    const clientId = config.data?.clientId;
    if (!clientId) throw new Error("Spotify is not configured yet.");
    await beginSpotifyLogin(clientId);
  }, [config.data?.clientId]);

  const disconnect = useCallback(() => {
    spotifyPlayback.disconnect();
    disconnectSpotify();
  }, []);

  return {
    configured: Boolean(config.data?.configured),
    connected: Boolean(session),
    playerStatus: status,
    playerError: error,
    connect,
    disconnect,
  };
}
