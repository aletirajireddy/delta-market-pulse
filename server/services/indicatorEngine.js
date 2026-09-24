const binance = require('./exchanges/binanceClient');
const { computeIndicators } = require('./indicators/technical');
const { findMegaSpots } = require('./indicators/megaSpot');
const { checkCascade } = require('./indicators/cascade');
const { computeSmartLevels, fibLevels } = require('./indicators/smartLevels');
const { getSessionMetrics } = require('./sessionMetrics');
const breakoutPersistence = require('./breakoutPersistence');

const TF_MAP = { m1: '1m', m5: '5m', m15: '15m', m30: '30m', h1: '1h', h4: '4h' };

function toCandle(k) {
  return { open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
}

// Full validated indicator set for one coin: EMA200/RSI/ATR/RVOL per TF,
// cascade state, mega-spot clusters, base/neck + fib smart levels, and
// UTC-session change%/volume. Only called for watched coins (qualifying,
// active, ghosted, majors, whitelist) — not the full 185-coin universe,
// to stay well under exchange rate limits.
async function computeFullSnapshot(base, binanceSymbol, now = Date.now()) {
  const tfResults = {};
  for (const [key, interval] of Object.entries(TF_MAP)) {
    const kl = await binance.getKlines(binanceSymbol, interval, 300);
    tfResults[key] = { candles: kl.map(toCandle), indicators: computeIndicators(kl.map(toCandle)) };
  }

  const pick = (field) => ({
    m1: tfResults.m1.indicators?.[field] ?? null,
    m5: tfResults.m5.indicators?.[field] ?? null,
    m15: tfResults.m15.indicators?.[field] ?? null,
    m30: tfResults.m30.indicators?.[field] ?? null,
    h1: tfResults.h1.indicators?.[field] ?? null,
    h4: tfResults.h4.indicators?.[field] ?? null,
  });
  const ema200 = pick('ema200');
  const rsi14 = pick('rsi14');
  const atrPct = pick('atrPct');
  const atr14 = pick('atr14');
  const rvol = pick('rvol');
  const adx = pick('adx');

  const consolidation = {};
  const activeBreakout = {};
  for (const tf of Object.keys(TF_MAP)) {
    const ind = tfResults[tf].indicators;
    consolidation[tf] = ind?.consolidation ?? null;
    activeBreakout[tf] = breakoutPersistence.recordAndGetActive(
      base, tf, !!ind?.breakoutUp, !!ind?.breakoutDown, now,
    );
  }

  const cascade = checkCascade(ema200, ['h4', 'h1', 'm15']);
  const counterCascade = checkCascade(ema200, ['m5', 'm1']);
  const megaSpots = findMegaSpots(ema200);

  // Base/neck reuse the h1 candles already fetched (drop the still-forming
  // last one). Daily/weekly need their own small fetches.
  const hourlyLevels = computeSmartLevels(tfResults.h1.candles.slice(0, -1));
  const [kl1d, klW, klM] = await Promise.all([
    binance.getKlines(binanceSymbol, '1d', 5),
    binance.getKlines(binanceSymbol, '1w', 5),
    binance.getKlines(binanceSymbol, '1M', 5),
  ]);
  const d = kl1d.map(toCandle);
  const w = klW.map(toCandle);
  const m = klM.map(toCandle);
  const dailyLevels = computeSmartLevels(d.slice(0, -1));
  const priorDaily = d[d.length - 2];
  const priorWeekly = w[w.length - 2];
  const priorMonthly = m[m.length - 2];
  const fib = {
    h1: hourlyLevels?.fib.fib618 ?? null,
    d1: priorDaily ? fibLevels(priorDaily.high, priorDaily.low).fib618 : null,
    w1: priorWeekly ? fibLevels(priorWeekly.high, priorWeekly.low).fib618 : null,
  };
  const toOHLC = (c) => (c ? { open: c.open, high: c.high, low: c.low, close: c.close } : null);
  const htf = {
    daily: toOHLC(priorDaily),
    weekly: toOHLC(priorWeekly),
    monthly: toOHLC(priorMonthly),
  };

  const session = await getSessionMetrics(binanceSymbol);

  return {
    ema200, rsi14, atrPct, atr14, rvol, adx, cascade, counterCascade, megaSpots,
    consolidation, activeBreakout,
    price: tfResults.m1.indicators?.close ?? tfResults.m5.indicators?.close ?? null,
    smartLevels: { daily: dailyLevels, hourly: hourlyLevels, fib, htf },
    sessionChangePct: session.changePct,
    sessionVolumeUsd: session.volumeUsd,
  };
}

module.exports = { computeFullSnapshot };
