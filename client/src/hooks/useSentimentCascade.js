import { useMemo } from 'react';
import { useEmaCandleWall } from './useEmaCandleWall';
import { useSentimentSettingsStore } from '../store/useSentimentSettingsStore';
import { checkCascade, REACTIVE_SERIES_PRESETS } from '../utils/cascade';
import { computePositionCode, positionCodeDirection } from '../utils/positionCode';

// Structural signal recomputed live from EMA Position Code (Stream A
// Column 26) — traced 2026-09-26 as the SIGNAL THAT ACTUALLY DRIVES the
// old app's market-wide mood/breadth, confirmed identically in both its
// authoritative locations: server/index.js's ingress "Genie Truth"
// recalculation (positionCode >= 300 = bullish, 100-199 = bearish) and
// the client's GenieSmart.analyzeMarketMood(). NOT the same thing as
// `cascade` (EMA200 ordering) or the old app's per-coin
// `calculateGenieScore()` (a 6-factor arbitrary-weighted setup-ranking
// composite, confirmed used only for individual coin ranking, never for
// market mood — deliberately not ported, same anti-composite-score
// principle this project already follows).
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
      const pc = computePositionCode(c.ema200, c.price);
      return {
        base: c.base,
        structural: positionCodeDirection(pc.posType),
        posType: pc.posType,
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
