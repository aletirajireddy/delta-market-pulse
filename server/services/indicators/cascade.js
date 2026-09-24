// Ported from tv-recommendation-fullstack's EMA Cascade logic (CLAUDE.md
// "EMA Cascade Logic (CORRECT DEFINITION)"). This is deliberately what
// replaces EMA Position Code as the primary structure signal — it compares
// actual EMA200 VALUES across timeframes in order (not just above/below
// counts), which is what actually distinguishes a clean trend stack from a
// scrambled/choppy one.
//
// In an uptrend, shorter-TF EMAs sit higher (they react faster to rising
// price): bull cascade = ema(longest) < ema(...) < ema(shortest).
//
// emas: { m5, m15, h1, h4 } EMA200 values.
// seriesTfs: ordered longest -> shortest, default ['h4','h1','m15'].
// threshold: % gap within which two adjacent levels are treated as equal
//   (cascade still holds through that level) — default 0.2%, matches the
//   old project's default.
function checkCascade(emas, seriesTfs = ['h4', 'h1', 'm15'], threshold = 0.2) {
  let isBull = true;
  let isBear = true;

  for (let i = 0; i < seriesTfs.length - 1; i++) {
    const emaLonger = emas[seriesTfs[i]];
    const emaShorter = emas[seriesTfs[i + 1]];
    if (emaLonger == null || emaShorter == null) return 'neutral';

    const pctDiff = ((emaShorter - emaLonger) / emaLonger) * 100;
    if (pctDiff < -threshold) isBull = false;
    if (pctDiff > threshold) isBear = false;
  }

  if (isBull && !isBear) return 'bull';
  if (isBear && !isBull) return 'bear';
  return 'neutral';
}

// Counter-trend check: is the short series (e.g. m5 vs m1, or here m5 vs
// m15) moving opposite to the long-series cascade, by more than noise
// (ATR)? Returns true only when the counter-move is real, not noise.
function isCounterTrendReal(shortEma, veryShortEma, atrValue) {
  if (shortEma == null || veryShortEma == null || atrValue == null) return false;
  return Math.abs(shortEma - veryShortEma) > atrValue;
}

module.exports = { checkCascade, isCounterTrendReal };
