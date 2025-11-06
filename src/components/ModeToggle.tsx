import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="ml-2">Toggle Mode</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => applyMode("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyMode("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyMode("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModeToggle;