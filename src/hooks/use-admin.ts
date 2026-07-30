import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  suspended_until: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
}

export interface AdminPlaylistRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_collaborative: boolean;
  is_hidden: boolean;
  moderation_note: string | null;
  moderated_at: string | null;
  created_at: string;
}

export const adminKeys = {
  isAdmin: (userId: string) => ["is-admin", userId] as const,
  users: () => ["admin", "users"] as const,
  roles: () => ["admin", "roles"] as const,
  playlists: () => ["admin", "playlists"] as const,
};

export function isSuspended(profile: Pick<AdminProfileRow, "suspended_until">) {
  return Boolean(profile.suspended_until && new Date(profile.suspended_until) > new Date());
}

export function useIsAdmin(userId?: string) {
  return useQuery({
    queryKey: adminKeys.isAdmin(userId ?? "anon"),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.users(),
    enabled,
    queryFn: async () => {
      const rows = await listAdminProfiles();
      return rows as AdminProfileRow[];
    },
  });
}

export function useAdminRoles(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.roles(),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: "admin" | "user" }[];
    },
  });
}

export function useAdminPlaylists(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.playlists(),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select(
          "id, owner_id, title, description, is_public, is_collaborative, is_hidden, moderation_note, moderated_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminPlaylistRow[];
    },
  });
}

export function useSuspendUser(adminId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; days: number | null; reason?: string }) => {
      const suspend = input.days !== null;
      const until = suspend
        ? new Date(Date.now() + input.days! * 86_400_000).toISOString()
        : null;
      const { error } = await supabase
        .from("profiles")
        .update({
          suspended_until: until,
          suspension_reason: suspend ? (input.reason?.trim() || "Policy violation") : null,
          suspended_at: suspend ? new Date().toISOString() : null,
          suspended_by: suspend ? adminId ?? null : null,
        })
        .eq("id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; makeAdmin: boolean }) => {
      if (input.makeAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: input.userId, role: "admin" });
        if (error && error.code !== "23505") throw error;
        return;
      }
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", input.userId)
        .eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.roles() }),
  });
}

export function useModeratePlaylist(adminId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { playlistId: string; hidden: boolean; note?: string }) => {
      const { error } = await supabase
        .from("playlists")
        .update({
          is_hidden: input.hidden,
          moderation_note: input.hidden ? (input.note?.trim() || "Hidden by moderator") : null,
          moderated_at: new Date().toISOString(),
          moderated_by: adminId ?? null,
        })
        .eq("id", input.playlistId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.playlists() }),
  });
}

export function useDeletePlaylistAsAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playlistId: string) => {
      const { error } = await supabase.from("playlists").delete().eq("id", playlistId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.playlists() }),
  });
}
