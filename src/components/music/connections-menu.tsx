import { useState } from "react";
import { Loader2, Music2, Youtube, RefreshCw, Link2Off, Plug } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpotifyConnection } from "@/hooks/use-spotify";
import {
  useConnectYouTube,
  useDisconnectAccount,
  useImportLibrary,
  useMusicConnections,
  useYouTubeAuthConfig,
  type ConnectionProvider,
} from "@/hooks/use-connections";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

function relative(iso: string | null): string {
  if (!iso) return "Never synced";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.round(hours / 24)}d ago`;
}

interface PillProps {
  provider: ConnectionProvider;
  label: string;
  icon: React.ReactNode;
  connected: boolean;
  accountLabel: string | null;
  lastSyncedAt: string | null;
  busy: boolean;
  onConnect: () => void;
  onImport: () => void;
  onDisconnect: () => void;
  note?: string | null;
}

function ConnectionPill({
  label,
  icon,
  connected,
  accountLabel,
  lastSyncedAt,
  busy,
  onConnect,
  onImport,
  onDisconnect,
  note,
}: PillProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={connected ? `${label} linked` : `Connect ${label}`}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors",
            connected
              ? "border-primary/40 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
          <span className="hidden sm:inline">{label}</span>
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {connected ? (accountLabel ?? "Account linked") : "Not connected"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {connected ? (
          <>
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {relative(lastSyncedAt)}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onImport()}>
              <RefreshCw className="mr-2 size-4" /> Import playlists &amp; likes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onConnect()}>
              <Plug className="mr-2 size-4" /> Reconnect
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDisconnect()}
            >
              <Link2Off className="mr-2 size-4" /> Disconnect
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => onConnect()}>
            <Plug className="mr-2 size-4" /> Connect {label}
          </DropdownMenuItem>
        )}
        {note ? (
          <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">{note}</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Header cluster letting the listener link their own Spotify and YouTube accounts. */
export function ConnectionsMenu({ className }: { className?: string }) {
  const { user } = useSession();
  const spotify = useSpotifyConnection();
  const youtubeConfig = useYouTubeAuthConfig();
  const connectYouTube = useConnectYouTube();
  const connections = useMusicConnections();
  const importLibrary = useImportLibrary();
  const disconnect = useDisconnectAccount();
  const [busyProvider, setBusyProvider] = useState<ConnectionProvider | null>(null);

  if (!user) return null;

  const rows = connections.data ?? [];
  const spotifyRow = rows.find((row) => row.provider === "spotify") ?? null;
  const youtubeRow = rows.find((row) => row.provider === "youtube") ?? null;

  const running = (provider: ConnectionProvider) =>
    busyProvider === provider ||
    (importLibrary.isPending && importLibrary.variables === provider) ||
    (disconnect.isPending && disconnect.variables === provider);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {spotify.configured ? (
        <ConnectionPill
          provider="spotify"
          label="Spotify"
          icon={<Music2 className="size-3.5" />}
          connected={Boolean(spotifyRow) || spotify.connected}
          accountLabel={spotifyRow?.accountLabel ?? null}
          lastSyncedAt={spotifyRow?.lastSyncedAt ?? null}
          busy={running("spotify")}
          onConnect={() => {
            setBusyProvider("spotify");
            spotify.connect().catch(() => setBusyProvider(null));
          }}
          onImport={() => importLibrary.mutate("spotify")}
          onDisconnect={() => {
            spotify.disconnect();
            disconnect.mutate("spotify");
          }}
          note="Premium accounts also unlock full-track playback."
        />
      ) : null}

      <ConnectionPill
        provider="youtube"
        label="YouTube"
        icon={<Youtube className="size-3.5" />}
        connected={Boolean(youtubeRow)}
        accountLabel={youtubeRow?.accountLabel ?? null}
        lastSyncedAt={youtubeRow?.lastSyncedAt ?? null}
        busy={running("youtube")}
        onConnect={() => {
          if (!youtubeConfig.data?.configured) return;
          setBusyProvider("youtube");
          connectYouTube().catch(() => setBusyProvider(null));
        }}
        onImport={() => importLibrary.mutate("youtube")}
        onDisconnect={() => disconnect.mutate("youtube")}
        note={
          youtubeConfig.data?.configured
            ? "Playlists sync both ways — you can push Sonance playlists back to YouTube."
            : "YouTube account linking isn't configured yet."
        }
      />
    </div>
  );
}
