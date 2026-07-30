import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MotionSettings } from "@/components/settings/motion-settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IMUSIC" },
      {
        name: "description",
        content:
          "Tune IMUSIC: pick your theme and control how new discoveries animate into your home feed.",
      },
      { property: "og:title", content: "Settings — IMUSIC" },
      {
        property: "og:description",
        content: "Theme and discovery motion controls, synced to your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="label-mono">Preferences</p>
          <h1 className="text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your choices sync to your account when you're signed in, and stay on this device
            otherwise.
          </p>
        </header>

        <section className="surface-panel flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              The accent palette also shifts with the time of day and season.
            </p>
          </div>
          <ThemeToggle className="w-fit" />
        </section>

        <section className="surface-panel flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Discovery motion</h2>
            <p className="text-sm text-muted-foreground">
              Controls how songs and artists added by a feed refresh animate in.
            </p>
          </div>
          <MotionSettings />
        </section>
      </div>
    </AppShell>
  );
}
