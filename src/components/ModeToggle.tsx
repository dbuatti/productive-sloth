import * as React from "react";
import { Moon, Sun } from "lucide-react";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

type Mode = "light" | "dark" | "system";

const ModeToggle: React.FC = () => {
  const [mode, setMode] = React.useState<Mode>(() => {
    if (typeof window !== "undefined") {
      const storedMode = localStorage.getItem("mode") as Mode;
      if (storedMode) return storedMode;
      
      // Default to system preference if no mode is stored
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  });

  const applyMode = React.useCallback((newMode: Mode) => {
    const root = window.document.documentElement;
    
    // IMPORTANT: Only remove light/dark classes, leave custom theme classes (e.g., theme-ocean) intact.
    root.classList.remove("light", "dark");

    if (newMode === "system") {
      const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(systemIsDark ? "dark" : "light");
    } else {
      root.classList.add(newMode);
    }
    localStorage.setItem("mode", newMode);
    setMode(newMode);
  }, []);

  React.useEffect(() => {
    applyMode(mode);
  }, [mode, applyMode]);

  return (
    <DropdownMenuRadioGroup value={mode} onValueChange={(value) => applyMode(value as Mode)}>
      <DropdownMenuRadioItem value="light">
        <Sun className="mr-2 h-4 w-4" />
        <span>Light</span>
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">
        <Moon className="mr-2 h-4 w-4" />
        <span>Dark</span>
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system">
        <Moon className="mr-2 h-4 w-4" />
        <span>System</span>
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
};

export default ModeToggle;