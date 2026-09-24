const { EMA, RSI, ATR, ADX, BollingerBands, SMA } = require('technicalindicators');

// candles: array of {open, high, low, close, volume, time}, oldest -> newest.
// Computes the standard per-TF indicator set locally, from raw OHLCV only —
// never trusts a pre-computed value from an exchange or vendor.
function computeIndicators(candles, { rvolLookback = 20 } = {}) {
  if (!candles || candles.length < 15) return null;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);

  const ema200Series = closes.length >= 200
    ? EMA.calculate({ period: 200, values: closes })
    : [];
  const rsi14Series = RSI.calculate({ period: 14, values: closes });
  const atr14Series = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const adxSeries = ADX.calculate({ period: 14, high: highs, low: lows, close: closes });

  const lastClose = closes[closes.length - 1];
  const ema200 = ema200Series.length ? ema200Series[ema200Series.length - 1] : null;
  const rsi14 = rsi14Series.length ? rsi14Series[rsi14Series.length - 1] : null;
  const atr14 = atr14Series.length ? atr14Series[atr14Series.length - 1] : null;
  const atrPct = atr14 && lastClose ? (atr14 / lastClose) * 100 : null;
  const lastAdx = adxSeries.length ? adxSeries[adxSeries.length - 1] : null;

  const window = volumes.slice(-rvolLookback);
  const avgVol = window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
  const lastVol = volumes[volumes.length - 1];
  const rvol = avgVol ? lastVol / avgVol : null;

  // Consolidation & Breakout — ported from tradingview_scanning_indicator.js's
  // "CONSOLIDATION & BREAKOUT" section. All thresholds match the Pine
  // script's defaults exactly (BB(20,2), ATR/volume avg length 20, ADX
  // weak-trend threshold 20, fast/slow EMA 9/26, MA-flat 0.5%, breakout
  // volume multiplier 1.5x). breakoutUp/Down are the raw "just happened on
  // this candle" booleans — persistence-window tracking (bars_since_breakout
  // in Pine) is handled by the caller, since we evaluate per-poll-cycle, not
  // per-bar.
  const bbSeries = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
  const lastBB = bbSeries.length ? bbSeries[bbSeries.length - 1] : null;
  const bbWidthPct = lastBB && lastBB.middle ? ((lastBB.upper - lastBB.lower) / lastBB.middle) : null;
  const isSqueezed = bbWidthPct != null ? bbWidthPct < 0.5 : null;

  const atrAvgSeries = atr14Series.length >= 14 ? SMA.calculate({ period: 14, values: atr14Series }) : [];
  const atrAvg = atrAvgSeries.length ? atrAvgSeries[atrAvgSeries.length - 1] : null;
  const isLowVolatility = atr14 != null && atrAvg != null ? atr14 < atrAvg : null;
  const isAtrExpanding = atr14 != null && atrAvg != null ? atr14 > atrAvg : null;

  const isLowVolume = lastVol != null && avgVol != null ? lastVol < avgVol : null;
  const isVolumeConfirmed = lastVol != null && avgVol != null ? lastVol > avgVol * 1.5 : null;

  const isWeakTrend = lastAdx != null ? lastAdx.adx < 20 : null;

  const ema9Series = EMA.calculate({ period: 9, values: closes });
  const ema26Series = EMA.calculate({ period: 26, values: closes });
  const ema9 = ema9Series.length ? ema9Series[ema9Series.length - 1] : null;
  const ema26 = ema26Series.length ? ema26Series[ema26Series.length - 1] : null;
  const maFlatPct = ema9 != null && ema26 != null && lastClose ? (Math.abs(ema9 - ema26) / lastClose) * 100 : null;
  const isMaFlat = maFlatPct != null ? maFlatPct < 0.5 : null;

  const consolidated = [isSqueezed, isLowVolatility, isLowVolume, isWeakTrend, isMaFlat].every((v) => v === true);
  const breakoutUp = lastBB != null && isVolumeConfirmed === true && isAtrExpanding === true && lastClose > lastBB.upper;
  const breakoutDown = lastBB != null && isVolumeConfirmed === true && isAtrExpanding === true && lastClose < lastBB.lower;

  return {
    close: lastClose,
    ema200,
    ema200DistPct: ema200 ? ((lastClose - ema200) / ema200) * 100 : null,
    rsi14,
    atr14, // raw absolute ATR (price units), needed for noise-filtered counter-trend checks
    atrPct,
    rvol,
    // ADX: trend STRENGTH (0-100), direction-agnostic — complements cascade,
    // which gives direction/structure but not conviction. +DI/-DI show which
    // side currently dominates, same info cascade already implies but as a
    // continuous number instead of a 3-state classification.
    adx: lastAdx ? lastAdx.adx : null,
    plusDI: lastAdx ? lastAdx.pdi : null,
    minusDI: lastAdx ? lastAdx.mdi : null,
    // Consolidation composite + its individual ingredients (mission-reframe
    // discipline: show the parts, not just the verdict).
    consolidation: {
      consolidated,
      isSqueezed, isLowVolatility, isLowVolume, isWeakTrend, isMaFlat,
      bbWidthPct, maFlatPct,
    },
    breakoutUp,
    breakoutDown,
  };
}

module.exports = { computeIndicators };
