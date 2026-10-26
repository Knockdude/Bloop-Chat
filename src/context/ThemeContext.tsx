import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeMode, FontSize } from '@/lib/types';

interface ThemeContextValue {
  theme: ThemeMode;
  fontSize: FontSize;
  reducedMotion: boolean;
  setTheme: (t: ThemeMode) => void;
  setFontSize: (s: FontSize) => void;
  setReducedMotion: (r: boolean) => void;
  resolved: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'bloop-prefs';

interface StoredPrefs {
  theme: ThemeMode;
  fontSize: FontSize;
  reducedMotion: boolean;
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredPrefs;
  } catch { /* ignore */ }
  return { theme: 'dark', fontSize: 'medium', reducedMotion: false };
}

function savePrefs(p: StoredPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StoredPrefs>(loadPrefs);
  const [resolved, setResolved] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function compute() {
      if (prefs.theme === 'system') {
        setResolved(mq.matches ? 'dark' : 'light');
      } else {
        setResolved(prefs.theme);
      }
    }
    compute();
    mq.addEventListener('change', compute);
    return () => mq.removeEventListener('change', compute);
  }, [prefs.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolved]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = prefs.fontSize;
    if (prefs.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [prefs.fontSize, prefs.reducedMotion]);

  const update = (p: Partial<StoredPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...p };
      savePrefs(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{
      theme: prefs.theme,
      fontSize: prefs.fontSize,
      reducedMotion: prefs.reducedMotion,
      setTheme: (t) => update({ theme: t }),
      setFontSize: (s) => update({ fontSize: s }),
      setReducedMotion: (r) => update({ reducedMotion: r }),
      resolved,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
