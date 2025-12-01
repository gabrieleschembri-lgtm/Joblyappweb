import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;
export type Theme = {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    card: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    muted: string;
    primary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    overlay: string;
    shadow: string;
  };
};

const STORAGE_KEY = 'jobly.theme.preference';

const light: Theme = {
  mode: 'light',
  colors: {
    background: '#f8fafc',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    muted: '#94a3b8',
    primary: '#2563eb',
    accent: '#0ea5e9',
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#ef4444',
    overlay: 'rgba(15, 23, 42, 0.45)',
    shadow: 'rgba(15, 23, 42, 0.08)',
  },
};

const dark: Theme = {
  mode: 'dark',
  colors: {
    background: '#0b1220',
    surface: '#0f172a',
    card: '#111827',
    border: '#1f2937',
    textPrimary: '#e2e8f0',
    textSecondary: '#cbd5e1',
    muted: '#94a3b8',
    primary: '#60a5fa',
    accent: '#38bdf8',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: 'rgba(0, 0, 0, 0.25)',
  },
};

const ThemeContext = createContext<{
  theme: Theme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => Promise<void>;
} | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);
  const [systemScheme, setSystemScheme] = useState<ThemeMode>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          if (!cancelled) setPreferenceState(stored);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  // Listen to system appearance changes to update theme live when preference is "system"
  React.useEffect(() => {
    const listener = ({ colorScheme }: { colorScheme: string | null }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    };

    const subscription = Appearance.addChangeListener(listener);
    return () => {
      // Support React Native < 0.65 remove API
      if (typeof subscription?.remove === 'function') {
        subscription.remove();
      } else {
        // @ts-ignore legacy
        Appearance.removeChangeListener?.(listener);
      }
    };
  }, []);

  const mode: ThemeMode = preference === 'system' ? systemScheme : preference;
  const theme = mode === 'dark' ? dark : light;

  const setPreference = useCallback(async (value: ThemePreference) => {
    setPreferenceState(value);
    await AsyncStorage.setItem(STORAGE_KEY, value);
  }, []);

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference, setPreference]);

  if (!hydrated) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export const useThemedStyles = <T,>(factory: (t: Theme) => T): T => {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
};
