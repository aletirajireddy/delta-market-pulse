import { useMemo } from 'react';
import { useEmaCandleWall } from './useEmaCandleWall';
import { useSentimentSettingsStore } from '../store/useSentimentSettingsStore';
import { checkCascade, STRUCTURAL_SERIES_PRESETS, REACTIVE_SERIES_PRESETS } from '../utils/cascade';

// Recomputes structural/reactive cascade per coin, live, from the full
// ema200 stack /api/ema-candle-wall already returns — using whichever TF
// series the user picked in Settings (Data & Sentiment), instead of the
// backend's fixed h4/h1/m15 + m5/m1 default. This only affects the
// CURRENT reading: the header's Net Bull % history chart is backend-
// persisted snapshot-by-snapshot with the default series, so past points
// can't be retroactively recomputed with a different series — only
// Gauge/Breadth (which read the latest state) reflect the user's choice.
export function useSentimentCascade(intervalMs) {
  const { data, lastUpdatedTs } = useEmaCandleWall(intervalMs);
  const structuralSeriesKey = useSentimentSettingsStore((s) => s.structuralSeriesKey);
  const reactiveSeriesKey = useSentimentSettingsStore((s) => s.reactiveSeriesKey);

  const result = useMemo(() => {
    const structuralTfs = STRUCTURAL_SERIES_PRESETS[structuralSeriesKey]?.tfs || STRUCTURAL_SERIES_PRESETS['h4-h1-m15'].tfs;
    const reactiveTfs = REACTIVE_SERIES_PRESETS[reactiveSeriesKey]?.tfs || REACTIVE_SERIES_PRESETS['m5-m1'].tfs;

    const coins = (data?.coins || []).map((c) => ({
      base: c.base,
      structural: checkCascade(c.ema200, structuralTfs),
      reactive: checkCascade(c.ema200, reactiveTfs),
    }));

    const structuralGroups = { bull: [], bear: [], neutral: [] };
    const reactiveGroups = { bull: [], bear: [], neutral: [] };
    for (const c of coins) {
      structuralGroups[c.structural].push(c.base);
      reactiveGroups[c.reactive].push(c.base);
    }

    const total = coins.length;
    const netBullPct =
      total > 0 ? ((structuralGroups.bull.length - structuralGroups.bear.length) / total) * 100 : null;

    return { coins, structuralGroups, reactiveGroups, netBullPct, total };
  }, [data, structuralSeriesKey, reactiveSeriesKey]);

  return { ...result, lastUpdatedTs };
}
