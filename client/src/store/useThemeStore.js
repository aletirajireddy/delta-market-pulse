import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Same semantic CSS-var token names as tv-recommendation-fullstack's
// useThemeStore.js — dozens of widgets will reference these by name, so the
// names carry over even though the actual hex values here are fresh.
const themes = {
  modern: {
    colors: {
      dark: {
        '--bg-app': '#0F172A',
        '--bg-panel': '#1E293B',
        '--bg-header': '#111827',
        '--bg-active': '#1F2937',
        '--border': '#334155',
        '--text-main': '#F1F5F9',
        '--text-muted': '#94A3B8',
        '--primary': '#2D3047',
        '--accent-green': '#10B981',
        '--accent-red': '#EF4444',
        '--accent-blue': '#3B82F6',
        '--accent-orange': '#F59E0B',
        '--success-bg': '#064E3B',
        '--success-text': '#6EE7B7',
        '--warning': '#F59E0B',
        '--warning-bg': '#78350F',
        '--warning-text': '#FCD34D',
      },
      light: {
        '--bg-app': '#F8FAFC',
        '--bg-panel': '#FFFFFF',
        '--bg-header': '#FFFFFF',
        '--bg-active': '#EFF6FF',
        '--border': '#E2E8F0',
        '--text-main': '#0F172A',
        '--text-muted': '#64748B',
        '--primary': '#2D3047',
        '--accent-green': '#059669',
        '--accent-red': '#DC2626',
        '--accent-blue': '#2563EB',
        '--accent-orange': '#D97706',
        '--success-bg': '#D1FAE5',
        '--success-text': '#065F46',
        '--warning': '#D97706',
        '--warning-bg': '#FEF3C7',
        '--warning-text': '#92400E',
      },
    },
  },
};

export const useThemeStore = create(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      activeThemeId: 'modern',
      themes,

      setThemeMode: (mode) => {
        set({ themeMode: mode });
        get().applyTheme();
      },

      applyTheme: () => {
        const { themeMode, activeThemeId, themes: t } = get();
        const root = document.documentElement;
        if (themeMode === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        const activeTheme = t[activeThemeId] || t.modern;
        const colors = activeTheme.colors[themeMode] || activeTheme.colors.dark;
        Object.entries(colors).forEach(([key, value]) => {
          root.style.setProperty(key, value);
        });
      },
    }),
    {
      name: 'delta-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) setTimeout(() => state.applyTheme(), 0);
      },
    }
  )
);
