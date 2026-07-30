import { getSpotifyAccessToken } from "./spotify-auth";

/**
 * Thin wrapper around the official Spotify Web Playback SDK.
 *
 * Full-track playback requires a Spotify Premium account; the SDK reports
 * `account_error` otherwise and we fall back to the 30s preview clip.
 */

export interface SpotifyPlaybackState {
  positionSec: number;
  durationSec: number;
  paused: boolean;
  ended: boolean;
}

interface SdkPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: never) => void) => void;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  setVolume: (value: number) => Promise<void>;
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as {
    Spotify?: unknown;
    onSpotifyWebPlaybackSDKReady?: () => void;
  };
  if (w.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve) => {
    w.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export type SpotifyPlayerStatus = "idle" | "connecting" | "ready" | "unavailable";

class SpotifyController {
  private player: SdkPlayer | null = null;
  private deviceId: string | null = null;
  private connecting: Promise<boolean> | null = null;

  status: SpotifyPlayerStatus = "idle";
  error: string | null = null;
  onState: ((state: SpotifyPlaybackState) => void) | null = null;
  onStatusChange: (() => void) | null = null;

  private setStatus(status: SpotifyPlayerStatus, error: string | null = null) {
    this.status = status;
    this.error = error;
    this.onStatusChange?.();
  }

  /** Boots the SDK and registers this browser as a Spotify Connect device. */
  async ensureReady(): Promise<boolean> {
    if (this.deviceId) return true;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const token = await getSpotifyAccessToken();
      if (!token) {
        this.setStatus("idle");
        return false;
      }
      this.setStatus("connecting");
      await loadSdk();
      const w = window as unknown as {
        Spotify: { Player: new (opts: Record<string, unknown>) => SdkPlayer };
      };

      const player = new w.Spotify.Player({
        name: "IMUSIC Web Player",
        getOAuthToken: (cb: (token: string) => void) => {
          void getSpotifyAccessToken().then((fresh) => fresh && cb(fresh));
        },
        volume: 0.8,
      });

      const ready = await new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        player.addListener("ready", ((payload: { device_id: string }) => {
          this.deviceId = payload.device_id;
          this.setStatus("ready");
          settle(true);
        }) as never);
        player.addListener("not_ready", (() => {
          this.deviceId = null;
        }) as never);
        player.addListener("account_error", ((payload: { message: string }) => {
          this.setStatus(
            "unavailable",
            "Spotify Premium is required for full-track playback — playing the preview clip instead.",
          );
          console.warn("Spotify account error:", payload?.message);
          settle(false);
        }) as never);
        player.addListener("initialization_error", ((payload: { message: string }) => {
          this.setStatus("unavailable", payload?.message ?? "Spotify playback unavailable.");
          settle(false);
        }) as never);
        player.addListener("authentication_error", ((payload: { message: string }) => {
          this.setStatus("unavailable", payload?.message ?? "Spotify session expired.");
          settle(false);
        }) as never);
        player.addListener("player_state_changed", ((payload: {
          position: number;
          duration: number;
          paused: boolean;
} | null) => {
          if (!payload) return;
          this.onState?.({
            positionSec: payload.position / 1000,
            durationSec: payload.duration / 1000,
            paused: payload.paused,
            ended: payload.paused && payload.position === 0,
          });
        }) as never);

        void player.connect().then((ok) => {
          if (!ok) {
            this.setStatus("unavailable", "Could not connect to Spotify playback.");
            settle(false);
          }
        });
        window.setTimeout(() => settle(Boolean(this.deviceId)), 12_000);
      });

      this.player = player;
      this.connecting = null;
      return ready;
    })();

    return this.connecting;
  }

  /** Starts a track URI on this device via the Web API. */
  async play(uri: string, positionMs = 0): Promise<boolean> {
    const ok = await this.ensureReady();
    if (!ok || !this.deviceId) return false;
    const token = await getSpotifyAccessToken();
    if (!token) return false;
    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
      },
    );
    if (res.ok || res.status === 204) return true;
    if (res.status === 403) {
      this.setStatus(
        "unavailable",
        "Spotify Premium is required for full-track playback — playing the preview clip instead.",
      );
    }
    return false;
  }

  async resume() {
    await this.player?.resume().catch(() => {});
  }
  async pause() {
    await this.player?.pause().catch(() => {});
  }
  async seek(seconds: number) {
    await this.player?.seek(Math.round(seconds * 1000)).catch(() => {});
  }
  async setVolume(value: number) {
    await this.player?.setVolume(Math.min(Math.max(value, 0), 1)).catch(() => {});
  }
  disconnect() {
    this.player?.disconnect();
    this.player = null;
    this.deviceId = null;
    this.setStatus("idle");
  }
}

export const spotifyPlayback = new SpotifyController();
