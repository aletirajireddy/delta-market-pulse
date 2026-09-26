// EMA Position Code (Stream A Column 26) is computed exactly ONCE,
// server-side (server/services/indicators/emaClustering.js's
// computePositionCode, called from indicatorEngine.js), persisted to
// coin_indicator_snapshot, and exposed via /api/ema-candle-wall and
// /api/coin/:base as `positionCode`. This file intentionally does NOT
// duplicate that calculation — it used to (a client-side port from raw
// ema200 values), which was a real drift risk flagged during review
// 2026-09-26 and removed. Only the trivial bucketing rule lives here.

// posType 3 (price above all 4 TF EMA200s) = bullish, posType 1 (below
// all) = bearish, everything else (2/4/5/0) = neutral — same bucketing
// as the old app's GenieSmart.analyzeMarketMood() (positionCode >= 300 /
// 100-199) and its server-side "Genie Truth" recalculation.
export function positionCodeDirection(posType) {
  if (posType === 3) return 'bull';
  if (posType === 1) return 'bear';
  return 'neutral';
}
