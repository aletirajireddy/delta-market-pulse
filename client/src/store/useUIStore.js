import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
    }),
    {
      name: 'delta-ui-storage',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
