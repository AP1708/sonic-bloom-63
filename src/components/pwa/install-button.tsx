import { useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

export function InstallButton({ className }: { className?: string }) {
  const { canShow, canInstall, ios, install } = useInstallPrompt();
  const [showIos, setShowIos] = useState(false);

  if (!canShow) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (canInstall ? void install() : setShowIos(true))}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
        aria-label="Install IMUSIC app"
      >
        <Download className="size-3.5" />
        <span className="hidden sm:inline">Install app</span>
      </button>

      {showIos && ios ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-end bg-background/70 p-4 sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Install IMUSIC on iPhone"
          onClick={() => setShowIos(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold">Add IMUSIC to your Home Screen</h2>
              <button type="button" onClick={() => setShowIos(false)} aria-label="Close">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Share className="size-4 shrink-0" /> Tap the Share button in Safari
              </li>
              <li className="flex items-center gap-2">
                <Plus className="size-4 shrink-0" /> Choose “Add to Home Screen”
              </li>
              <li className="flex items-center gap-2">
                <Download className="size-4 shrink-0" /> Open IMUSIC from your new app icon
              </li>
            </ol>
          </div>
        </div>
      ) : null}
    </>
  );
}
