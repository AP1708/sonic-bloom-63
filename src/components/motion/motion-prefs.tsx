import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyMotionPrefs,
  DEFAULT_MOTION_PREFS,
  motionPrefsEqual,
  normalizeMotionPrefs,
  prefersReducedMotion,
  type MotionPrefs,
} from "@/lib/motion/motion-prefs";
import { getMotionPreference, setMotionPreference } from "@/lib/motion/motion.functions";

const STORAGE_KEY = "discovery-motion";

interface MotionContextValue {
  prefs: MotionPrefs;
  /** True when the OS asks for reduced motion. */
  systemReduced: boolean;
  /** True when entrance animations are currently suppressed. */
  animationsDisabled: boolean;
  setPrefs: (next: Partial<MotionPrefs>) => void;
  reset: () => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

function readLocal(): MotionPrefs {
  if (typeof window === "undefined") return DEFAULT_MOTION_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeMotionPrefs(JSON.parse(raw)) : DEFAULT_MOTION_PREFS;
  } catch {
    return DEFAULT_MOTION_PREFS;
  }
}

export function MotionPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<MotionPrefs>(DEFAULT_MOTION_PREFS);
  const [systemReduced, setSystemReduced] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Local storage is the instant, offline-capable source of truth.
  useEffect(() => {
    setPrefsState(readLocal());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(media.matches);
    const listener = (event: MediaQueryListEvent) => setSystemReduced(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    applyMotionPrefs(prefs, systemReduced);
  }, [prefs, systemReduced]);

  const applyLocally = useCallback((next: MotionPrefs) => {
    setPrefsState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — in-memory is fine */
    }
  }, []);

  // Account sync: pull on load / sign-in, then stay live via Realtime.
  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const remote = await getMotionPreference();
        if (cancelled || !remote?.prefs) return;
        const next = normalizeMotionPrefs(remote.prefs);
        if (!motionPrefsEqual(next, prefsRef.current)) applyLocally(next);
      } catch {
        /* offline or signed out */
      }
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled || channel) return;

      channel = supabase
        .channel(`motion-sync-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const raw = (payload.new as { motion_preference?: unknown } | null)?.motion_preference;
            if (!raw || Object.keys(raw as object).length === 0) return;
            const next = normalizeMotionPrefs(raw);
            if (!motionPrefsEqual(next, prefsRef.current)) applyLocally(next);
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

    void pull();
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
  }, [applyLocally]);

  const push = useCallback((next: MotionPrefs) => {
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await setMotionPreference({ data: next });
      } catch {
        /* best effort */
      }
    })();
  }, []);

  const setPrefs = useCallback(
    (patch: Partial<MotionPrefs>) => {
      const next = normalizeMotionPrefs({ ...prefsRef.current, ...patch });
      applyLocally(next);
      push(next);
    },
    [applyLocally, push],
  );

  const reset = useCallback(() => {
    applyLocally(DEFAULT_MOTION_PREFS);
    push(DEFAULT_MOTION_PREFS);
  }, [applyLocally, push]);

  const value = useMemo<MotionContextValue>(
    () => ({
      prefs,
      systemReduced,
      animationsDisabled:
        prefs.style === "off" || (prefs.respectReducedMotion && systemReduced),
      setPrefs,
      reset,
    }),
    [prefs, systemReduced, setPrefs, reset],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionPrefs(): MotionContextValue {
  const value = useContext(MotionContext);
  // Fall back to defaults so cards render fine outside the provider (SSR, tests).
  return (
    value ?? {
      prefs: DEFAULT_MOTION_PREFS,
      systemReduced: prefersReducedMotion(),
      animationsDisabled: false,
      setPrefs: () => {},
      reset: () => {},
    }
  );
}
