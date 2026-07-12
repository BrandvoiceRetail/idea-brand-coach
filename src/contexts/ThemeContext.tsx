/**
 * ThemeContext — light / dark mode for the surface.
 *
 * The product's SSOT visual is Trevor's dark v23 ("dark liquid glass"), so the
 * default is `dark`. A user can flip to a light (cream / light-glass) register;
 * the choice persists per-device in localStorage and is applied as the `dark`
 * class on <html> (Tailwind `darkMode: ["class"]`). index.html applies the same
 * class pre-hydration to avoid a flash of the wrong theme.
 *
 * This is the only theme global; check here before adding any other theme state.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'idea-theme';
const DEFAULT_THEME: Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Read the persisted theme, falling back to the dark default. SSR/edge-safe. */
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Reflect the theme onto <html> so Tailwind `dark:` + the .dark token block apply. */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode / storage disabled — theme still applies for this session */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
