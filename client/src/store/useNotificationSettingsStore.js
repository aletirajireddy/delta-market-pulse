import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// In-app Smart Alerts on/off + a Telegram toggle stub, per
// docs/NEXT_SESSION_HANDOFF.md: "Telegram gets a settings-UI toggle now
// but the actual bot integration is deferred — build the switch, wire it
// later." No backend call yet for the Telegram flag.
export const useNotificationSettingsStore = create(
  persist(
    (set) => ({
      inAppAlertsEnabled: true,
      telegramEnabled: false,
      setInAppAlertsEnabled: (v) => set({ inAppAlertsEnabled: v }),
      setTelegramEnabled: (v) => set({ telegramEnabled: v }),
    }),
    { name: 'delta-notification-settings' }
  )
);
