import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Unable to verify permissions");
  if (!data) throw new Error("Forbidden");
}

export interface AdminProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  suspended_until: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
}

export const listAdminProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminProfile[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, suspended_until, suspension_reason, suspended_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Unable to load users");
    return (data ?? []) as AdminProfile[];
  });

const suspendSchema = z.object({
  userId: z.string().uuid(),
  days: z.number().int().min(1).max(3650).nullable(),
  reason: z.string().trim().max(500).optional(),
});

export const setUserSuspension = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => suspendSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const suspend = data.days !== null;
    const until = suspend ? new Date(Date.now() + data.days! * 86_400_000).toISOString() : null;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        suspended_until: until,
        suspension_reason: suspend ? data.reason?.trim() || "Policy violation" : null,
        suspended_at: suspend ? new Date().toISOString() : null,
        suspended_by: suspend ? context.userId : null,
      })
      .eq("id", data.userId);
    if (error) throw new Error("Unable to update suspension");
    return { ok: true };
  });
