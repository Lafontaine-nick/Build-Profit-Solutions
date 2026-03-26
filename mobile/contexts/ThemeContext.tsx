import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeTokens = {
  // Core surfaces
  bg: string;
  card: string;
  cardDark: string; // optional: for slightly darker cards inside light mode
  surface: string;  // glass panel
  surface2: string; // row/input surface
  hairline: string; // borders/dividers
  overlay: string;  // modal dim

  // Text
  text: string;
  subtext: string;

  // Accents
  accent: string;
  onAccent: string;

  // Misc
  iconBg: string;

  // Optional: keep if you use gradient screen backgrounds
  background: [string, string, string, string];
};

interface ThemeContextType {
  darkMode: boolean;
  setDarkMode: (v: boolean) => Promise<void>;
  theme: ThemeTokens;
}

const DARK: ThemeTokens = {
  bg: "#000000",
  card: "#000000",
  cardDark: "#000000",

  surface: "rgba(255,255,255,0.04)",
  surface2: "rgba(255,255,255,0.06)",
  hairline: "rgba(255,255,255,0.10)",
  overlay: "rgba(0,0,0,0.70)",

  text: "#FFFFFF",
  subtext: "#FFFFFF",

  accent: "#2DFFC4",     // keep your brand
  onAccent: "#050B13",   // dark text works on your neon gradient

  iconBg: "rgba(45,255,196,0.14)",

  background: ["#0b1c38", "#1B365D", "#2d5a3d", "#43cea2"],
};

const LIGHT: ThemeTokens = {
  // Light mode keeps the brand feel, but adds stronger hierarchy and borders.
  bg: "#F4F7FB",
  card: "#FFFFFF",
  cardDark: "#F8FBFF",

  surface: "#EEF3F8",
  surface2: "#E3EBF4",
  hairline: "rgba(15,23,42,0.10)",
  overlay: "rgba(0,0,0,0.45)",

  text: "#0F172A",
  subtext: "#475569",

  accent: "#22C55E",
  onAccent: "#FFFFFF",

  iconBg: "#E7EEF6",

  background: ["#F7FAFD", "#F4F7FB", "#F2F7FB", "#EEF6F7"],
};

const ThemeContext = createContext<ThemeContextType>({
  darkMode: true,
  setDarkMode: async () => {},
  theme: DARK,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkModeState] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem("darkMode");
        if (saved !== null) setDarkModeState(JSON.parse(saved));

        // Optional backend sync (you already have this pattern)
        try {
          const apiService = require("@/services/api").apiService;
          const settings = await apiService.getUserSettings();
          if (settings?.darkMode !== undefined) {
            setDarkModeState(settings.darkMode);
            await AsyncStorage.setItem("darkMode", JSON.stringify(settings.darkMode));
          }
        } catch {
          // backend unavailable is fine
        }
      } catch (e) {
        console.log("Theme load error", e);
      }
    };
    load();
  }, []);

  const setDarkMode = async (value: boolean) => {
    setDarkModeState(value);
    try {
      await AsyncStorage.setItem("darkMode", JSON.stringify(value));
      try {
        const apiService = require("@/services/api").apiService;
        await apiService.updatePreferences({ darkMode: value });
      } catch {
        // ignore
      }
    } catch (e) {
      console.log("Theme save error", e);
    }
  };

  const theme = useMemo(() => (darkMode ? DARK : LIGHT), [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
