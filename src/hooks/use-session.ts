import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface SessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

/**
 * Client-side session mirror. Route protection lives in the `_authenticated`
 * layout — this hook only drives UI affordances (avatar, sign-in CTA).
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ session, user: session?.user ?? null, loading: false });
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
