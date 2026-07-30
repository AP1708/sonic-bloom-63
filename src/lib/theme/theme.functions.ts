import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const themeSchema = z.enum(["light", "dark", "system"]);

export const getThemePreference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("theme_preference")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) return { theme: null as "light" | "dark" | "system" | null };

    const parsed = themeSchema.safeParse(data?.theme_preference);
    return { theme: parsed.success ? parsed.data : null };
  });

export const setThemePreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ theme: themeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ theme_preference: data.theme })
      .eq("id", context.userId);

    if (error) throw new Error("Could not save theme preference");
    return { ok: true };
  });
