const { EMA, RSI, ATR } = require('technicalindicators');

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

  const lastClose = closes[closes.length - 1];
  const ema200 = ema200Series.length ? ema200Series[ema200Series.length - 1] : null;
  const rsi14 = rsi14Series.length ? rsi14Series[rsi14Series.length - 1] : null;
  const atr14 = atr14Series.length ? atr14Series[atr14Series.length - 1] : null;
  const atrPct = atr14 && lastClose ? (atr14 / lastClose) * 100 : null;

  const window = volumes.slice(-rvolLookback);
  const avgVol = window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
  const lastVol = volumes[volumes.length - 1];
  const rvol = avgVol ? lastVol / avgVol : null;

  return {
    close: lastClose,
    ema200,
    ema200DistPct: ema200 ? ((lastClose - ema200) / ema200) * 100 : null,
    rsi14,
    atr14,
    atrPct,
    rvol,
  };
}

module.exports = { computeIndicators };
