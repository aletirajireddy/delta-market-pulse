import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Per docs/FRONTEND_TIME_CONVENTIONS.md — binding spec, copied verbatim.
// The frontend never asks the browser/OS what timezone it's in; it asks
// this one global, user-controlled, persisted setting.

export const TIMEZONES = {
  'Asia/Kolkata': { label: 'India (IST)', short: 'IST' },
  UTC: { label: 'UTC', short: 'UTC' },
  'America/New_York': { label: 'US Eastern (ET)', short: 'ET' },
};

export const DATE_FORMATS = {
  'DD/MMM/YY': { label: '25/Sep/26' },
  'DD/MM/YYYY': { label: '25/09/2026' },
  'YYYY-MM-DD': { label: '2026-09-25 (ISO)' },
  'MMM DD, YYYY': { label: 'Sep 25, 2026' },
};

export const TIME_FORMATS = {
  '12h': { label: '02:32:07 PM' },
  '24h': { label: '14:32:07' },
};

export const useDisplaySettingsStore = create(
  persist(
    (set) => ({
      timezone: 'Asia/Kolkata', // NEVER auto-detected from the browser/OS
      dateFormat: 'DD/MMM/YY',
      timeFormat: '12h',
      setTimezone: (tz) => set({ timezone: tz }),
      setDateFormat: (fmt) => set({ dateFormat: fmt }),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
    }),
    { name: 'display-settings-storage' }
  )
);
