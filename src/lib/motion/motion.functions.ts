import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeMotionPrefs } from "./motion-prefs";

const motionSchema = z.object({
  style: z.enum(["rise", "fade", "pop", "slide", "off"]),
  intensity: z.number().int().min(1).max(5),
  durationMs: z.number().int().min(200).max(900),
  staggerMs: z.number().int().min(0).max(120),
  badgeMs: z.number().int().min(0).max(120000),
  respectReducedMotion: z.boolean(),
});

export const getMotionPreference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("motion_preference")
      .eq("id", context.userId)
      .maybeSingle();

    const raw = (data as { motion_preference?: unknown } | null)?.motion_preference;
    if (error || !raw || Object.keys(raw as object).length === 0) return { prefs: null };
    return { prefs: normalizeMotionPrefs(raw) };
  });

export const setMotionPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => motionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ motion_preference: data } as never)
      .eq("id", context.userId);

    if (error) throw new Error("Could not save motion preference");
    return { ok: true };
  });
