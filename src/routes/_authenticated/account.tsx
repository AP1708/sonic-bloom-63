import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, LogOut, ShieldAlert, Unplug } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useLikedSongs, usePlaylists } from "@/hooks/use-library";
import { useOfflineIds } from "@/hooks/use-offline";
import { useDisconnectAccount, useMusicConnections } from "@/hooks/use-connections";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account — IMUSIC" },
      {
        name: "description",
        content:
          "Manage your IMUSIC profile: display name, avatar, account status and connected music services.",
      },
      { property: "og:title", content: "Your account — IMUSIC" },
      {
        property: "og:description",
        content: "Profile details, account status and connected services in one place.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AccountPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: profile, isPending } = useQuery({
    queryKey: ["my-profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, created_at, suspended_at, suspended_until, suspension_reason",
        )
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save your profile."),
  });

  const { data: playlists } = usePlaylists(userId);
  const { data: liked } = useLikedSongs(userId);
  const offlineIds = useOfflineIds();
  const { data: connections } = useMusicConnections();
  const disconnect = useDisconnectAccount();

  const suspended = Boolean(profile?.suspended_at);
  const dirty =
    (profile?.display_name ?? "") !== displayName || (profile?.avatar_url ?? "") !== avatarUrl;

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-14 rounded-full object-cover"
              onError={() => setAvatarUrl("")}
            />
          ) : (
            <span className="grid size-14 place-items-center rounded-full bg-primary font-mono text-base text-primary-foreground">
              {initials(displayName || user?.email)}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="label-mono">Your account</p>
            <h1 className="truncate text-3xl">{displayName || user?.email || "Listener"}</h1>
            <p className="text-sm text-muted-foreground">
              Member since {formatDate(profile?.created_at ?? null)}
            </p>
          </div>
        </header>

        <section
          className={`surface-panel flex flex-col gap-2 p-6 ${suspended ? "border border-destructive/50" : ""}`}
          aria-live="polite"
        >
          <h2 className="flex items-center gap-2 text-lg">
            {suspended ? (
              <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            )}
            Account status
          </h2>
          {isPending ? (
            <div className="h-4 w-40 animate-pulse rounded bg-surface-raised" />
          ) : suspended ? (
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <p className="text-destructive">
                Your account is suspended since {formatDate(profile?.suspended_at ?? null)}.
              </p>
              <p>Reason: {profile?.suspension_reason?.trim() || "No reason given."}</p>
              <p>
                {profile?.suspended_until
                  ? `Suspension ends ${formatDate(profile.suspended_until)}.`
                  : "No end date set — contact support to appeal."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Active — full access to playback, playlists and downloads.
            </p>
          )}
        </section>

        <section className="surface-panel flex flex-col gap-4 p-6">
          <h2 className="text-lg">Profile details</h2>
          <label className="flex flex-col gap-1.5 text-sm">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={60}
              placeholder="What should we call you?"
              className="h-11 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Avatar image link
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="h-11 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Email
            <input
              value={user?.email ?? ""}
              readOnly
              aria-readonly="true"
              className="h-11 rounded-lg border border-border bg-surface-raised px-3 text-sm text-muted-foreground"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
            <Link
              to="/settings"
              className="h-10 rounded-lg border border-border px-4 text-sm leading-10 transition-colors hover:border-primary"
            >
              Appearance settings
            </Link>
          </div>
        </section>

        <section className="surface-panel flex flex-col gap-4 p-6">
          <h2 className="text-lg">Connected services</h2>
          {connections?.length ? (
            <ul className="flex flex-col gap-2">
              {connections.map((connection) => (
                <li
                  key={connection.provider}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm">
                      {connection.provider === "youtube" ? "YouTube Music" : "Spotify"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {connection.accountLabel ?? "Connected"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      disconnect.mutate(connection.provider as "spotify" | "youtube")
                    }
                    disabled={disconnect.isPending}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
                  >
                    <Unplug className="size-3.5" aria-hidden="true" />
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No music accounts linked yet. Use the connect menu in the top bar to link Spotify or
              YouTube Music.
            </p>
          )}
        </section>

        <section className="surface-panel grid grid-cols-3 gap-4 p-6 text-center">
          <Stat label="Playlists" value={playlists?.length ?? 0} />
          <Stat label="Liked songs" value={liked?.length ?? 0} />
          <Stat label="Offline songs" value={offlineIds.size} />
        </section>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-11 w-fit items-center gap-2 rounded-lg border border-border px-4 text-sm transition-colors hover:border-destructive hover:text-destructive"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-2xl">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
