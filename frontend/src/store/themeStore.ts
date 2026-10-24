import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme: ThemeMode =
    (typeof window !== 'undefined' && (localStorage.getItem('pulse-theme') as ThemeMode)) || 'light';

  // Apply immediately on load
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    document.documentElement.classList.toggle('light', initialTheme === 'light');
  }

  return {
    theme: initialTheme,
    setTheme: (theme: ThemeMode) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pulse-theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.classList.toggle('light', theme === 'light');
      }
      set({ theme });
    },
    toggleTheme: () => {
      const next: ThemeMode = get().theme === 'light' ? 'dark' : 'light';
      get().setTheme(next);
    },
  };
});
