import { usePoll } from './usePoll';

// Shared by MarketBreadth (header) and the EmaCandleWall widget so both
// consume one poll of /api/ema-candle-wall instead of two.
export function useEmaCandleWall(intervalMs) {
  return usePoll('/api/ema-candle-wall', intervalMs);
}

// field: 'cascade' (slow, structural — EMA200 h4/h1/m15) or 'counterCascade'
// (fast, reactive — EMA200 m5/m1). Two genuinely different signals, kept
// separate rather than blended — see ARCHITECTURE_DECISIONS.md §7 and the
// 2026-09-25 header-breadth audit (structural cascade alone showed 0
// bearish coins even with a coin down -46% same day, because EMA200 is a
// long-lookback average that doesn't react to a single day's move; the
// fast counterCascade series does).
export function groupByField(coins, field = 'cascade') {
  const groups = { bull: [], bear: [], neutral: [] };
  for (const c of coins || []) {
    const value = c[field];
    const key = groups[value] ? value : 'neutral';
    groups[key].push(c.base);
  }
  return groups;
}

export function groupByCascade(coins) {
  return groupByField(coins, 'cascade');
}
