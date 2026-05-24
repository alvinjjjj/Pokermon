import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  darkColors,
  lightColors,
  type ColorTokens,
  type ThemeMode,
  THEME_STORAGE_KEY,
} from '../constants/colors';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ColorTokens;
  setMode: (m: ThemeMode) => Promise<void>;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
        }
      } catch {
        // AsyncStorage read failed — default 'light' is fine
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, m);
    } catch {
      // Persistence best-effort; in-memory state already updated
    }
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, isReady }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
