import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

import {
  ColorScheme,
  createShadows,
  darkColors,
  lightColors,
} from "@/constants/theme";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "dhebu:theme-mode";

interface ThemeContextValue {
  mode: ThemeMode;
  activeScheme: "light" | "dark";
  colors: ColorScheme;
  shadows: ReturnType<typeof createShadows>;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  const activeScheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const colors = activeScheme === "dark" ? darkColors : lightColors;
  const shadows = useMemo(() => createShadows(colors), [colors]);

  const value = useMemo(
    () => ({ mode, activeScheme, colors, shadows, setMode }),
    [mode, activeScheme, colors, shadows],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
