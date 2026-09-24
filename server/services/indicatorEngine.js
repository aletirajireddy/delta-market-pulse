const binance = require('./exchanges/binanceClient');
const { computeIndicators } = require('./indicators/technical');
const { findMegaSpots } = require('./indicators/megaSpot');
const { checkCascade } = require('./indicators/cascade');
const { computeSmartLevels, fibLevels } = require('./indicators/smartLevels');
const { getSessionMetrics } = require('./sessionMetrics');

const TF_MAP = { m5: '5m', m15: '15m', h1: '1h', h4: '4h' };

function toCandle(k) {
  return { open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
}

// Full validated indicator set for one coin: EMA200/RSI/ATR/RVOL per TF,
// cascade state, mega-spot clusters, base/neck + fib smart levels, and
// UTC-session change%/volume. Only called for watched coins (qualifying,
// active, ghosted, majors, whitelist) — not the full 185-coin universe,
// to stay well under exchange rate limits.
async function computeFullSnapshot(binanceSymbol) {
  const tfResults = {};
  for (const [key, interval] of Object.entries(TF_MAP)) {
    const kl = await binance.getKlines(binanceSymbol, interval, 300);
    tfResults[key] = { candles: kl.map(toCandle), indicators: computeIndicators(kl.map(toCandle)) };
  }

  const ema200 = {
    m5: tfResults.m5.indicators?.ema200 ?? null,
    m15: tfResults.m15.indicators?.ema200 ?? null,
    h1: tfResults.h1.indicators?.ema200 ?? null,
    h4: tfResults.h4.indicators?.ema200 ?? null,
  };
  const rsi14 = {
    m5: tfResults.m5.indicators?.rsi14 ?? null,
    m15: tfResults.m15.indicators?.rsi14 ?? null,
    h1: tfResults.h1.indicators?.rsi14 ?? null,
    h4: tfResults.h4.indicators?.rsi14 ?? null,
  };
  const atrPct = {
    m5: tfResults.m5.indicators?.atrPct ?? null,
    m15: tfResults.m15.indicators?.atrPct ?? null,
    h1: tfResults.h1.indicators?.atrPct ?? null,
    h4: tfResults.h4.indicators?.atrPct ?? null,
  };
  const rvol = {
    m5: tfResults.m5.indicators?.rvol ?? null,
    m15: tfResults.m15.indicators?.rvol ?? null,
    h1: tfResults.h1.indicators?.rvol ?? null,
    h4: tfResults.h4.indicators?.rvol ?? null,
  };

  const cascade = checkCascade(ema200);
  const megaSpots = findMegaSpots(ema200);

  // Base/neck reuse the h1 candles already fetched (drop the still-forming
  // last one). Daily/weekly need their own small fetches.
  const hourlyLevels = computeSmartLevels(tfResults.h1.candles.slice(0, -1));
  const [kl1d, klW] = await Promise.all([
    binance.getKlines(binanceSymbol, '1d', 5),
    binance.getKlines(binanceSymbol, '1w', 5),
  ]);
  const d = kl1d.map(toCandle);
  const w = klW.map(toCandle);
  const dailyLevels = computeSmartLevels(d.slice(0, -1));
  const priorDaily = d[d.length - 2];
  const priorWeekly = w[w.length - 2];
  const fib = {
    h1: hourlyLevels?.fib.fib618 ?? null,
    d1: priorDaily ? fibLevels(priorDaily.high, priorDaily.low).fib618 : null,
    w1: priorWeekly ? fibLevels(priorWeekly.high, priorWeekly.low).fib618 : null,
  };

  const session = await getSessionMetrics(binanceSymbol);

  return {
    ema200, rsi14, atrPct, rvol, cascade, megaSpots,
    smartLevels: { daily: dailyLevels, hourly: hourlyLevels, fib },
    sessionChangePct: session.changePct,
    sessionVolumeUsd: session.volumeUsd,
  };
}

module.exports = { computeFullSnapshot };
