"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "visionverse:theme";
const ORDER: ThemePreference[] = ["light", "dark", "system"];

// useLayoutEffect warns during server rendering; fall back to useEffect there.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "light" || saved === "system"
      ? saved
      : "light";
  } catch {
    return "light";
  }
}

function savePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Blocked storage just means the choice isn't remembered.
  }
}

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

type ThemeContextValue = {
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Turns on dark mode for the page it wraps. The `dark` class goes on <html>
 * (so dialogs and menus rendered outside the page match too) and is removed
 * when the page unmounts, so the editor and the quiz player stay as designed.
 */
export function DashboardThemeScope({ children }: { children: ReactNode }) {
  // Light unless the user picks otherwise, so nobody gets surprised.
  const [preference, setPreferenceState] = useState<ThemePreference>("light");
  const [systemDark, setSystemDark] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setPreferenceState(readPreference());
    setSystemDark(systemPrefersDark());
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const isDark = preference === "dark" || (preference === "system" && systemDark);

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    return () => root.classList.remove("dark");
  }, [isDark]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    savePreference(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, isDark, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

const LABELS: Record<ThemePreference, string> = {
  light: "Light mode",
  dark: "Dark mode",
  system: "Match system",
};

/** Cycles light, dark and system. Only works inside DashboardThemeScope. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useContext(ThemeContext);
  if (!theme) return null;
  const next = ORDER[(ORDER.indexOf(theme.preference) + 1) % ORDER.length]!;
  const Icon =
    theme.preference === "light" ? Sun : theme.preference === "dark" ? Moon : Monitor;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className ?? "h-9 w-9"}
      onClick={() => theme.setPreference(next)}
      title={`${LABELS[theme.preference]} (switch to ${LABELS[next].toLowerCase()})`}
      aria-label={`Theme: ${LABELS[theme.preference]}. Switch to ${LABELS[next].toLowerCase()}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
