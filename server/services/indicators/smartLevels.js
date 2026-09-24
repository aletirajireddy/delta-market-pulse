// Ported from smart-levels_indicator.js section 4 (FIBONACCI & LOGIC POINT
// CALCULATIONS). "Base" = a consolidation signature across the last 2
// completed candles of a TF; "Neck" = a small reversal-pattern signature
// across the same 2 candles. c1 = most recently closed candle, c2 = the one
// before it (both {open, high, low, close}).
function baseNeck(c1, c2) {
  if (!c1 || !c2) return { baseSupport: null, baseResistance: null, neckSupport: null, neckResistance: null };
  const tol = c1.open * 0.001;

  const baseSupport = (Math.abs(c2.close - c1.open) < tol || Math.abs(c2.low - c1.low) < tol)
    ? Math.min(c1.low, c2.low) : null;
  const baseResistance = (Math.abs(c2.close - c1.open) < tol || Math.abs(c2.high - c1.high) < tol)
    ? Math.max(c1.high, c2.high) : null;

  const neckSupport = (c2.close < c2.open && c1.close > c1.open && c1.close > c2.open && c1.open < c2.close)
    ? c2.high : null;
  const neckResistance = (c2.close > c2.open && c1.close < c1.open && c1.close < c2.low && c1.open > c2.high)
    ? c2.low : null;

  return { baseSupport, baseResistance, neckSupport, neckResistance };
}

function fibLevels(high, low) {
  if (high == null || low == null) return { fib50: null, fib618: null };
  return { fib50: low + (high - low) * 0.5, fib618: low + (high - low) * 0.618 };
}

// candles: oldest -> newest, at least 2 closed candles needed for base/neck.
// c1 = candles[candles.length-1] is the LAST CLOSED candle (caller must
// exclude any still-forming candle before passing it in).
function computeSmartLevels(candles) {
  if (!candles || candles.length < 2) return null;
  const c1 = candles[candles.length - 1];
  const c2 = candles[candles.length - 2];
  return { ...baseNeck(c1, c2), fib: fibLevels(c1.high, c1.low) };
}

module.exports = { baseNeck, fibLevels, computeSmartLevels };
