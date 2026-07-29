import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, AlertTriangle } from "lucide-react";
import { completeSpotifyLogin } from "@/lib/music/spotify-auth";

export const Route = createFileRoute("/spotify/callback")({
  head: () => ({
    meta: [
      { title: "Connecting Spotify — Sonance" },
      { name: "description", content: "Finishing the secure Spotify account connection." },
      { property: "og:title", content: "Connecting Spotify — Sonance" },
      { property: "og:description", content: "Finishing the secure Spotify account connection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SpotifyCallback,
});

function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const denied = params.get("error");
    if (denied) {
      setError(denied === "access_denied" ? "You cancelled the Spotify connection." : denied);
      return;
    }
    const code = params.get("code");
    if (!code) {
      setError("Spotify did not return an authorization code.");
      return;
    }
    completeSpotifyLogin(code)
      .then((back) => navigate({ to: back, replace: true }))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not connect Spotify."),
      );
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <AlertTriangle className="size-6 text-destructive" />
            <h1 className="text-lg">Spotify connection failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/", replace: true })}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Back to Sonance
            </button>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin text-primary" />
            <h1 className="text-lg">Connecting your Spotify account…</h1>
            <p className="text-sm text-muted-foreground">Hang tight, this only takes a moment.</p>
          </>
        )}
      </div>
    </main>
  );
}
