import { useMemo } from 'react';
import { useEmaCandleWall } from './useEmaCandleWall';
import { useSentimentSettingsStore } from '../store/useSentimentSettingsStore';
import { checkCascade, REACTIVE_SERIES_PRESETS } from '../utils/cascade';
import { positionCodeDirection } from '../utils/positionCode';

// Structural signal reads `positionCode` DIRECTLY off the API response
// (server/index.js's /api/ema-candle-wall) — computed exactly once,
// server-side, in indicatorEngine.js, persisted to coin_indicator_snapshot,
// and never recomputed independently here. Single source of truth
// (2026-09-26 fix: this hook used to re-derive positionCode client-side
// from raw ema200 values, a real duplicate-logic/drift risk flagged
// during review — removed in favor of just reading the backend's own
// authoritative value).
//
// positionCode (Stream A Column 26, EMA Position Code) is traced as the
// SIGNAL THAT ACTUALLY DRIVES the old app's market-wide mood/breadth,
// confirmed identically in both its authoritative locations:
// server/index.js's ingress "Genie Truth" recalculation (positionCode
// >= 300 = bullish, 100-199 = bearish) and the client's
// GenieSmart.analyzeMarketMood(). NOT the same thing as `cascade` (EMA200
// ordering) or the old app's per-coin `calculateGenieScore()` (a
// 6-factor arbitrary-weighted setup-ranking composite, confirmed used
// only for individual coin ranking, never for market mood — deliberately
// not ported, same anti-composite-score principle this project already
// follows).
//
// positionCode has no configurable TF series (fixed m5/m15/h1/h4, per
// Stream A's real definition) — only the Reactive signal (fast EMA200
// counter-cascade) keeps a user-selectable series.
export function useSentimentCascade(intervalMs) {
  const { data, lastUpdatedTs } = useEmaCandleWall(intervalMs);
  const reactiveSeriesKey = useSentimentSettingsStore((s) => s.reactiveSeriesKey);

  const result = useMemo(() => {
    const reactiveTfs = REACTIVE_SERIES_PRESETS[reactiveSeriesKey]?.tfs || REACTIVE_SERIES_PRESETS['m5-m1'].tfs;

    const coins = (data?.coins || []).map((c) => {
      const posType = c.positionCode ?? 0;
      return {
        base: c.base,
        structural: positionCodeDirection(posType),
        posType,
        reactive: checkCascade(c.ema200, reactiveTfs),
      };
    });

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
  }, [data, reactiveSeriesKey]);

  return { ...result, lastUpdatedTs };
}
