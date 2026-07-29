import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { PlayerBar } from "@/components/player/player-bar";
import { SidePanel } from "@/components/player/side-panel";
import { SpotifyConnectButton } from "@/components/music/spotify-connect";
import { FullscreenPlayer } from "@/components/player/fullscreen-player";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme";
import { usePlayer } from "@/components/player/player-provider";
import { useSession } from "@/hooks/use-session";
import { useLikedSongs, useToggleLike } from "@/hooks/use-library";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/format";


export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const navigate = useNavigate();
  const router = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useSession();
  const player = usePlayer();
  const { data: liked } = useLikedSongs(user?.id);
  const toggleLike = useToggleLike(user?.id);

  const currentLiked = Boolean(
    player.current && liked?.some((track) => track.id === player.current?.id),
  );

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        {mobileNav && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="bg-background">
              <Sidebar onNavigate={() => setMobileNav(false)} />
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              className="flex-1 bg-background/70"
              onClick={() => setMobileNav(false)}
            >
              <X className="ml-4 size-5" />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNav(true)}
                aria-label="Open navigation"
                className="text-muted-foreground lg:hidden"
              >
                <Menu className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                aria-label="Go back"
                className="hidden size-8 place-items-center rounded-full bg-surface text-muted-foreground hover:text-foreground lg:grid"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => window.history.forward()}
                aria-label="Go forward"
                className="hidden size-8 place-items-center rounded-full bg-surface text-muted-foreground hover:text-foreground lg:grid"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle className="hidden sm:flex" />
              <MobileThemeToggle />
              <SpotifyConnectButton />
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-primary font-mono text-xs text-primary-foreground">
                    {initials(user.user_metadata?.display_name ?? user.email)}
                  </span>
                  <button
                    type="button"
                    onClick={signOut}
                    className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
                  >
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  search={{ redirect: router }}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Sign in
                </Link>
              )}
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 lg:px-8">{children}</main>
            <SidePanel />
          </div>
        </div>
      </div>

      <PlayerBar
        liked={currentLiked}
        onToggleLike={
          player.current
            ? () => toggleLike.mutate({ track: player.current!, liked: currentLiked })
            : undefined
        }
      />
      <FullscreenPlayer />
    </div>
  );
}
