import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { isNativeApp, NATIVE_URL_SCHEME } from "@/lib/native/platform";
import { completeSpotifyLogin } from "@/lib/music/spotify-auth";

/**
 * Wires the packaged Android app to the web UI:
 *  - finishes Spotify sign-in when the phone browser returns to the app
 *  - hides the splash screen once React has painted
 *  - keeps the status bar matched to the dark shell
 *
 * Renders nothing and is inert in a normal browser.
 */
export function NativeBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    void (async () => {
      const [{ App }, { Browser }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
      ]);
      if (disposed) return;

      void SplashScreen.hide().catch(() => undefined);
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: "#0A0A0B" }).catch(() => undefined);

      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        if (!url.startsWith(`${NATIVE_URL_SCHEME}://spotify/callback`)) return;
        void Browser.close().catch(() => undefined);
        const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
        const params = new URLSearchParams(query);
        const denied = params.get("error");
        if (denied) {
          toast.error(
            denied === "access_denied"
              ? "You cancelled the Spotify connection."
              : "Spotify connection failed.",
          );
          return;
        }
        const code = params.get("code");
        if (!code) {
          toast.error("Spotify didn't send back a sign-in code. Please try again.");
          return;
        }
        completeSpotifyLogin(code)
          .then((back) => {
            toast.success("Spotify connected.");
            void navigate({ to: back, replace: true });
          })
          .catch((err: unknown) =>
            toast.error(err instanceof Error ? err.message : "Could not connect Spotify."),
          );
      });
      cleanups.push(() => void handle.remove());
    })();

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, [navigate]);

  return null;
}
