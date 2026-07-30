import { Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MotionSettings } from "./motion-settings";
import { Link } from "@tanstack/react-router";

/** Quick access to the discovery motion controls from the app header. */
export function SettingsMenu() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open settings"
        className="grid size-8 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-h-[80vh] overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium">Discovery motion</p>
          <Link to="/settings" className="text-xs text-primary hover:underline">
            All settings
          </Link>
        </div>
        <MotionSettings compact />
      </PopoverContent>
    </Popover>
  );
}
