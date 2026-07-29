import { Link, useRouterState } from "@tanstack/react-router";
import {
  Compass,
  Heart,
  Home,
  Library,
  ListPlus,
  Search,
  Music4,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaylists } from "@/hooks/use-library";
import { useSession } from "@/hooks/use-session";

const NAV = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Your library", icon: Library },
  { to: "/liked", label: "Liked songs", icon: Heart },
] as { to: string; label: string; icon: typeof Home; exact?: boolean }[];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useSession();
  const { data: playlists } = usePlaylists(user?.id);

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-6">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2 px-2">
        <Music4 className="size-5 text-primary" />
        <span className="font-display text-lg tracking-tight">SONANCE</span>
      </Link>

      <ul className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-raised text-foreground"
                    : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-4", active && "text-primary")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between px-3">
          <span className="label-mono">Playlists</span>
          <Link to="/library" onClick={onNavigate} aria-label="Create playlist">
            <ListPlus className="size-4 text-muted-foreground hover:text-foreground" />
          </Link>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {playlists?.length ? (
            playlists.map((playlist) => (
              <li key={playlist.id}>
                <Link
                  to="/playlist/$playlistId"
                  params={{ playlistId: playlist.id }}
                  onClick={onNavigate}
                  className="block truncate rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  {playlist.title}
                </Link>
              </li>
            ))
          ) : (
            <li className="px-3 py-1.5 text-xs text-muted-foreground">
              {user ? "No playlists yet." : "Sign in to build your library."}
            </li>
          )}
        </ul>
      </div>

      <Link
        to="/search"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Compass className="size-4" /> Explore sources
      </Link>
    </nav>
  );
}
