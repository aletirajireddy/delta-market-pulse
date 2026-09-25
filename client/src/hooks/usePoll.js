import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../utils/api';
import { useSentimentSettingsStore } from '../store/useSentimentSettingsStore';

// Shared polling hook: fetch on mount + setInterval, tracks data/error/
// freshness. When no explicit intervalMs is passed, falls back to the
// global poll-interval setting (Settings > Data & Sentiment) — backend
// indicator snapshots only refresh on their own ~60s cycle
// (server/config/thresholds.js pollIntervalMs), so polling faster than
// that just re-fetches identical data. Pass an explicit intervalMs only
// when a widget genuinely needs a different cadence (e.g. /health).
export function usePoll(path, intervalMs) {
  const globalIntervalMs = useSentimentSettingsStore((s) => s.pollIntervalMs);
  const effectiveIntervalMs = intervalMs ?? globalIntervalMs;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdatedTs, setLastUpdatedTs] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;

    async function tick() {
      try {
        const json = await apiGet(path);
        if (cancelled) return;
        setData(json);
        setError(null);
        setLastUpdatedTs(Date.now());
      } catch (err) {
        if (cancelled) return;
        setError(err);
      }
    }

    tick();
    timerRef.current = setInterval(tick, effectiveIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [path, effectiveIntervalMs]);

  return { data, error, lastUpdatedTs };
}
