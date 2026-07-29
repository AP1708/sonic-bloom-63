import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolved, setTheme } = useTheme();

  return (
    <div className={cn("flex items-center rounded-full border border-border bg-surface p-0.5", className)}>
      <ThemeOption
        active={theme === "light"}
        onClick={() => setTheme("light")}
        label="Light"
        icon={Sun}
      />
      <ThemeOption
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
        label="Dark"
        icon={Moon}
      />
      <ThemeOption
        active={theme === "system"}
        onClick={() => setTheme("system")}
        label="System"
        icon={Monitor}
      />
      <span className="sr-only">Current theme: {resolved}</span>
    </div>
  );
}

function ThemeOption({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Sun;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Use ${label} theme`}
      aria-pressed={active}
      className={cn(
        "grid size-7 place-items-center rounded-full transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
