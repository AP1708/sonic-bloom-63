import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, AlertTriangle } from "lucide-react";
import { completeYouTubeConnect } from "@/lib/music/connections.functions";

export const Route = createFileRoute("/youtube/callback")({
  head: () => ({
    meta: [
      { title: "Connecting YouTube — Sonance" },
      { name: "description", content: "Finishing the secure YouTube account connection." },
      { property: "og:title", content: "Connecting YouTube — Sonance" },
      { property: "og:description", content: "Finishing the secure YouTube account connection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: YouTubeCallback,
});

const STATE_KEY = "sonance.youtube.state";
const RETURN_KEY = "sonance.youtube.return";

function YouTubeCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const denied = params.get("error");
    if (denied) {
      setError(denied === "access_denied" ? "You cancelled the YouTube connection." : denied);
      return;
    }
    const code = params.get("code");
    const state = params.get("state");
    const expected = sessionStorage.getItem(STATE_KEY);
    if (!code) {
      setError("Google did not return an authorization code.");
      return;
    }
    if (!expected || state !== expected) {
      setError("This connection link has expired — please try again.");
      return;
    }
    sessionStorage.removeItem(STATE_KEY);
    const back = sessionStorage.getItem(RETURN_KEY) ?? "/";
    sessionStorage.removeItem(RETURN_KEY);

    completeYouTubeConnect({
      data: { code, redirectUri: `${window.location.origin}/youtube/callback` },
    })
      .then(() => navigate({ to: back.startsWith("/") ? back : "/", replace: true }))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not connect YouTube."),
      );
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <AlertTriangle className="size-6 text-destructive" />
            <h1 className="text-lg">YouTube connection failed</h1>
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
            <h1 className="text-lg">Connecting your YouTube account…</h1>
            <p className="text-sm text-muted-foreground">Hang tight, this only takes a moment.</p>
          </>
        )}
      </div>
    </main>
  );
}
