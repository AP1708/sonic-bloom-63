import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/hooks/use-session";
import {
  isSuspended,
  useAdminPlaylists,
  useAdminRoles,
  useAdminUsers,
  useDeletePlaylistAsAdmin,
  useIsAdmin,
  useModeratePlaylist,
  useSetUserRole,
  useSuspendUser,
} from "@/hooks/use-admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — Sonance" },
      { name: "description", content: "Moderate Sonance accounts, roles, and shared playlists." },
      { property: "og:title", content: "Admin console — Sonance" },
      { property: "og:description", content: "User suspensions and playlist moderation for Sonance." },
    ],
  }),
  component: AdminPage,
});

type Tab = "users" | "content";

function AdminPage() {
  const { user } = useSession();
  const { data: admin, isLoading: checking } = useIsAdmin(user?.id);
  const [tab, setTab] = useState<Tab>("users");

  if (checking) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Checking permissions…</p>
      </AppShell>
    );
  }

  if (!admin) {
    return (
      <AppShell>
        <div className="surface-panel mx-auto max-w-md p-8 text-center">
          <ShieldOff className="mx-auto mb-3 size-6 text-muted-foreground" />
          <h1 className="text-xl">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is restricted to accounts with the admin role.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="label-mono">Moderation</p>
          <h1 className="text-3xl">Admin console</h1>
        </header>

        <div className="flex gap-2">
          {(["users", "content"] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                tab === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-raised text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "users" ? "Users & roles" : "Playlist moderation"}
            </button>
          ))}
        </div>

        {tab === "users" ? <UsersPanel adminId={user?.id} /> : <ContentPanel adminId={user?.id} />}
      </div>
    </AppShell>
  );
}

function UsersPanel({ adminId }: { adminId?: string }) {
  const { data: users, isLoading } = useAdminUsers(true);
  const { data: roles } = useAdminRoles(true);
  const suspend = useSuspendUser(adminId);
  const setRole = useSetUserRole();
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const adminIds = useMemo(
    () => new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id)),
    [roles],
  );

  const filtered = (users ?? []).filter((u) =>
    (u.display_name ?? u.id).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search users"
        aria-label="Search users"
        className="h-10 w-full max-w-sm rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : null}
      {!isLoading && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts match that search.</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {filtered.map((profile) => {
          const suspended = isSuspended(profile);
          const isAdminUser = adminIds.has(profile.id);
          const self = profile.id === adminId;
          return (
            <li key={profile.id} className="surface-panel flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {profile.display_name ?? "Unnamed listener"}
                    {self ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                  </p>
                  <p className="label-mono truncate text-xs text-muted-foreground">{profile.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdminUser ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">admin</span>
                  ) : null}
                  {suspended ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                      suspended until {new Date(profile.suspended_until!).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>

              {suspended && profile.suspension_reason ? (
                <p className="text-xs text-muted-foreground">Reason: {profile.suspension_reason}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {!suspended ? (
                  <>
                    <input
                      value={reasons[profile.id] ?? ""}
                      onChange={(event) =>
                        setReasons((prev) => ({ ...prev, [profile.id]: event.target.value }))
                      }
                      placeholder="Suspension reason"
                      aria-label={`Suspension reason for ${profile.display_name ?? profile.id}`}
                      className="h-9 flex-1 min-w-48 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                    />
                    {[7, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        disabled={self || suspend.isPending}
                        onClick={() =>
                          suspend.mutate(
                            { userId: profile.id, days, reason: reasons[profile.id] },
                            {
                              onSuccess: () => toast.success(`Suspended for ${days} days`),
                              onError: (error) => toast.error((error as Error).message),
                            },
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5 text-xs hover:text-destructive disabled:opacity-40"
                      >
                        <UserX className="size-3.5" /> {days}d
                      </button>
                    ))}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={suspend.isPending}
                    onClick={() =>
                      suspend.mutate(
                        { userId: profile.id, days: null },
                        {
                          onSuccess: () => toast.success("Suspension lifted"),
                          onError: (error) => toast.error((error as Error).message),
                        },
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5 text-xs hover:text-primary disabled:opacity-40"
                  >
                    <UserCheck className="size-3.5" /> Reinstate
                  </button>
                )}

                <button
                  type="button"
                  disabled={self || setRole.isPending}
                  onClick={() =>
                    setRole.mutate(
                      { userId: profile.id, makeAdmin: !isAdminUser },
                      {
                        onSuccess: () =>
                          toast.success(isAdminUser ? "Admin role removed" : "Admin role granted"),
                        onError: (error) => toast.error((error as Error).message),
                      },
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5 text-xs hover:text-foreground disabled:opacity-40"
                >
                  {isAdminUser ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                  {isAdminUser ? "Revoke admin" : "Make admin"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ContentPanel({ adminId }: { adminId?: string }) {
  const { data: playlists, isLoading } = useAdminPlaylists(true);
  const moderate = useModeratePlaylist(adminId);
  const remove = useDeletePlaylistAsAdmin();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "public" | "hidden">("all");

  const visible = (playlists ?? []).filter((playlist) => {
    if (filter === "public") return playlist.is_public && !playlist.is_hidden;
    if (filter === "hidden") return playlist.is_hidden;
    return true;
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["all", "public", "hidden"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs capitalize transition-colors",
              filter === value
                ? "bg-surface-raised text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading playlists…</p> : null}
      {!isLoading && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to moderate here.</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {visible.map((playlist) => (
          <li key={playlist.id} className="surface-panel flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{playlist.title}</p>
                <p className="label-mono truncate text-xs text-muted-foreground">
                  owner {playlist.owner_id}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-muted-foreground">
                  {playlist.is_public ? "public" : "private"}
                </span>
                {playlist.is_collaborative ? (
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-muted-foreground">
                    collaborative
                  </span>
                ) : null}
                {playlist.is_hidden ? (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">hidden</span>
                ) : null}
              </div>
            </div>

            {playlist.description ? (
              <p className="text-xs text-muted-foreground">{playlist.description}</p>
            ) : null}
            {playlist.is_hidden && playlist.moderation_note ? (
              <p className="text-xs text-muted-foreground">Note: {playlist.moderation_note}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {!playlist.is_hidden ? (
                <input
                  value={notes[playlist.id] ?? ""}
                  onChange={(event) =>
                    setNotes((prev) => ({ ...prev, [playlist.id]: event.target.value }))
                  }
                  placeholder="Moderation note"
                  aria-label={`Moderation note for ${playlist.title}`}
                  className="h-9 flex-1 min-w-48 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                />
              ) : null}
              <button
                type="button"
                disabled={moderate.isPending}
                onClick={() =>
                  moderate.mutate(
                    {
                      playlistId: playlist.id,
                      hidden: !playlist.is_hidden,
                      note: notes[playlist.id],
                    },
                    {
                      onSuccess: () =>
                        toast.success(playlist.is_hidden ? "Playlist restored" : "Playlist hidden"),
                      onError: (error) => toast.error((error as Error).message),
                    },
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5 text-xs hover:text-foreground disabled:opacity-40"
              >
                {playlist.is_hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {playlist.is_hidden ? "Restore" : "Hide"}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete “${playlist.title}” permanently?`)) return;
                  remove.mutate(playlist.id, {
                    onSuccess: () => toast.success("Playlist deleted"),
                    onError: (error) => toast.error((error as Error).message),
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
