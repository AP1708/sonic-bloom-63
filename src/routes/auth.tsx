import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Music4 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — IMUSIC" },
      { name: "description", content: "Sign in to sync your IMUSIC playlists, liked songs, and queue." },
      { property: "og:title", content: "Sign in — IMUSIC" },
      { property: "og:description", content: "Access your IMUSIC library across devices." },
    ],
  }),
  component: AuthPage,
});

function safePath(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = safePath(search.redirect);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${destination}`,
          data: { display_name: displayName || email.split("@")[0] },
        },
      });
      setBusy(false);
      if (signUpError) return setError(signUpError.message);
      setNotice("Check your inbox to confirm your address, then sign in.");
      setMode("signin");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) return setError(signInError.message);
    if (destination.includes("?")) {
      window.location.href = destination;
      return;
    }
    navigate({ to: destination, replace: true });
  }

  async function onGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${destination}`,
    });
    if (result.error) return setError("Google sign-in failed. Try again.");
    if (result.redirected) return;
    if (destination.includes("?")) {
      window.location.href = destination;
      return;
    }
    navigate({ to: destination, replace: true });
  }


  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Music4 className="size-5 text-primary" />
          <span className="font-display text-lg tracking-tight">IMUSIC</span>
        </Link>

        <div className="surface-panel flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="text-2xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-muted-foreground">
              Sync playlists and liked songs across devices.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoogle}
            className="h-11 rounded-lg border border-border bg-surface-raised text-sm font-medium transition-colors hover:border-primary"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="label-mono">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Display name"
                aria-label="Display name"
                className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-primary">{notice}</p>}
            <button
              type="submit"
              disabled={busy}
              className={cn(
                "h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity",
                busy && "opacity-60",
              )}
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New to IMUSIC?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
