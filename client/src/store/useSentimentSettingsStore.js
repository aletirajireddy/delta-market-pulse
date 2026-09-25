import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Global, user-controlled config for the Reactive breadth signal's TF
// series (see utils/cascade.js) and how often the client polls the
// backend. Structural (Gauge/Breadth's slow signal) is EMA Position Code
// — fixed m5/m15/h1/h4 per Stream A's real definition, not configurable
// (see utils/positionCode.js). Backend indicator snapshots refresh on
// their own ~60s poll cycle (server/config/thresholds.js pollIntervalMs)
// — polling faster than that just re-fetches the same values, so the
// default here matches it rather than an arbitrary short interval.
export const POLL_INTERVALS = {
  30000: { label: '30s' },
  60000: { label: '1 min (matches backend refresh)' },
  180000: { label: '3 min' },
  300000: { label: '5 min' },
};

export const useSentimentSettingsStore = create(
  persist(
    (set) => ({
      reactiveSeriesKey: 'm5-m1',
      pollIntervalMs: 60000,
      setReactiveSeriesKey: (key) => set({ reactiveSeriesKey: key }),
      setPollIntervalMs: (ms) => set({ pollIntervalMs: ms }),
    }),
    { name: 'delta-sentiment-settings' }
  )
);
