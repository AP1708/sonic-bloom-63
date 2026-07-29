import { exchangeSpotifyCode, refreshSpotifyToken } from "@/lib/music/spotify.functions";

/**
 * Browser-side Spotify user session (Authorization Code + PKCE).
 *
 * The code exchange and refresh both happen in server functions, so the client
 * secret never reaches the browser. Only the user's own access token is stored
 * locally — it is what the Web Playback SDK needs to stream full tracks.
 */

const STORAGE_KEY = "sonance.spotify.session";
const VERIFIER_KEY = "sonance.spotify.verifier";
const RETURN_KEY = "sonance.spotify.return";

export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export interface SpotifySession {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export function redirectUri(): string {
  return `${window.location.origin}/spotify/callback`;
}

export function readSession(): SpotifySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpotifySession;
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: SpotifySession | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("sonance:spotify-session"));
}

export function disconnectSpotify() {
  writeSession(null);
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Sends the user to Spotify's consent screen (top-level navigation, not an iframe). */
export async function beginSpotifyLogin(clientId: string) {
  const verifier = randomString(64);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", await pkceChallenge(verifier));
  const target = window.top ?? window;
  target.location.href = url.toString();
}

export async function completeSpotifyLogin(code: string): Promise<string> {
  const codeVerifier = sessionStorage.getItem(VERIFIER_KEY) ?? "";
  if (!codeVerifier) throw new Error("Login session expired — please try connecting again.");
  const tokens = await exchangeSpotifyCode({
    data: { code, codeVerifier, redirectUri: redirectUri() },
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  writeSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresInSec * 1000,
  });
  const back = sessionStorage.getItem(RETURN_KEY) ?? "/";
  sessionStorage.removeItem(RETURN_KEY);
  return back.startsWith("/") ? back : "/";
}

/** Returns a valid access token, refreshing it when it is close to expiring. */
export async function getSpotifyAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 60_000) return session.accessToken;
  if (!session.refreshToken) {
    writeSession(null);
    return null;
  }
  try {
    const tokens = await refreshSpotifyToken({ data: { refreshToken: session.refreshToken } });
    const next: SpotifySession = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? session.refreshToken,
      expiresAt: Date.now() + tokens.expiresInSec * 1000,
    };
    writeSession(next);
    return next.accessToken;
  } catch {
    writeSession(null);
    return null;
  }
}
