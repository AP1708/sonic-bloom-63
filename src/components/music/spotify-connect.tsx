import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useSpotifyConnection } from "@/hooks/use-spotify";
import { cn } from "@/lib/utils";

/** Header control that links (or unlinks) the listener's own Spotify account. */
export function SpotifyConnectButton({ className }: { className?: string }) {
  const { configured, connected, connect, disconnect, playerError } = useSpotifyConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return null;

  if (connected) {
    return (
      <button
        type="button"
        onClick={disconnect}
        title={playerError ?? "Spotify account linked"}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-primary" />
        Spotify linked
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        setError(null);
        connect().catch((err: unknown) => {
          setBusy(false);
          setError(err instanceof Error ? err.message : "Could not start Spotify login.");
        });
      }}
      title={error ?? "Sign in with Spotify for full-track playback (Premium)"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60",
        className,
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
      Connect Spotify
    </button>
  );
}
