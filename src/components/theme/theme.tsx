import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyAmbience, getAmbience, type Ambience } from "@/lib/theme/ambience";
import { getThemePreference, setThemePreference } from "@/lib/theme/theme.functions";
import { supabase } from "@/integrations/supabase/client";


type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  /** Accent palette derived from the current time of day and season. */
  ambience: Ambience;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return getSystemTheme();
  return theme;
}

function applyThemeClass(theme: "light" | "dark") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : resolveTheme("system"),
  );
  const [ambience, setAmbience] = useState<Ambience>(() => getAmbience());

  // Re-derive the accent palette on mount and every few minutes so the theme
  // follows the clock (and, over time, the season) without a reload.
  useEffect(() => {
    const tick = () => setAmbience(getAmbience());
    tick();
    const interval = setInterval(tick, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    applyAmbience(ambience, resolved);
  }, [ambience, resolved]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored ?? "system";
    setThemeState(initial);
    const resolved = resolveTheme(initial);
    setResolved(resolved);
    applyThemeClass(resolved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      setThemeState((current) => {
        if (current === "system") {
          const next = getSystemTheme();
          setResolved(next);
          applyThemeClass(next);
        }
        return current;
      });
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Apply a theme locally without writing it back to the account. Used when we
  // adopt the value stored on the signed-in profile.
  const applyLocally = (next: Theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setThemeState(next);
    const nextResolved = resolveTheme(next);
    setResolved(nextResolved);
    applyThemeClass(nextResolved);
  };

  // Pull the account-level preference on load and whenever the signed-in user
  // changes, so the choice follows you across devices. Local storage stays the
  // instant, offline-capable source of truth; the account value wins on a
  // fresh load / sign-in.
  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const remote = await getThemePreference();
        if (cancelled || !remote?.theme) return;
        const local = localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (remote.theme !== local) applyLocally(remote.theme);
      } catch {
        // Offline or signed out — local storage already covers us.
      }
    };

    void pull();

    // Live sync: watch this user's profile row so a theme change made in
    // another tab or device lands here instantly.
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled || channel) return;

      channel = supabase
        .channel(`theme-sync-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const next = (payload.new as { theme_preference?: string } | null)
              ?.theme_preference;
            if (next !== "light" && next !== "dark" && next !== "system") return;
            if (next === (localStorage.getItem(STORAGE_KEY) as Theme | null)) return;
            applyLocally(next);
          },
        )
        .subscribe();
    };

    const teardown = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    void subscribe();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void pull();
        teardown();
        void subscribe();
      }
      if (event === "SIGNED_OUT") teardown();
    });

    return () => {
      cancelled = true;
      teardown();
      sub.subscription.unsubscribe();
    };
  }, []);


  const setTheme = (next: Theme) => {
    applyLocally(next);
    // Best-effort account sync; never blocks or interrupts the UI.
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await setThemePreference({ data: { theme: next } });
      } catch {
        /* ignore */
      }
    })();
  };

  const toggle = () => {
    setTheme(resolved === "dark" ? "light" : "dark");
  };


  return (
    <ThemeContext.Provider value={{ theme, resolved, ambience, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

/**
 * Inline script that runs in the HTML head before React hydration to prevent
 * a flash of the wrong theme. It reads the persisted preference and sets the
 * dark class on <html> before the first paint.
 */
export function ThemeScript() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              const theme = localStorage.getItem('${STORAGE_KEY}');
              if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } catch (e) {}
          })();
        `,
      }}
    />
  );
}
