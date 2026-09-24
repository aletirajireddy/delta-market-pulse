const db = require('./db/database');
const universe = require('./data/coinUniverse.json');
const binance = require('./services/exchanges/binanceClient');
const delta = require('./services/exchanges/deltaClient');
const { evaluateFilter } = require('./services/watchlist/filterEngine');
const graduationGate = require('./services/watchlist/graduationGate');
const ghostPrune = require('./services/watchlist/ghostPrune');
const { checkOiSpike } = require('./services/oiSpike');
const { computeFullSnapshot } = require('./services/indicatorEngine');
const smartAlertsEvaluator = require('./services/smartAlerts/evaluator');

const insertSnapshot = db.prepare(`
  INSERT OR REPLACE INTO coin_ticker_snapshot
    (base, ts, price, change_pct_24h, volume_usd_24h, oi_usd, funding_rate, source)
  VALUES (@base, @ts, @price, @change_pct_24h, @volume_usd_24h, @oi_usd, @funding_rate, @source)
`);
const insertPulse = db.prepare('INSERT OR REPLACE INTO watchlist_pulse (ts, qualifying_count, active_count) VALUES (?, ?, ?)');
const insertIndicatorSnapshot = db.prepare(`
  INSERT OR REPLACE INTO coin_indicator_snapshot
    (base, ts, price, ema200, rsi14, atrPct, atr14, rvol, cascade, counterCascade, megaSpots, smartLevels, sessionChangePct, sessionVolumeUsd)
  VALUES (@base, @ts, @price, @ema200, @rsi14, @atrPct, @atr14, @rvol, @cascade, @counterCascade, @megaSpots, @smartLevels, @sessionChangePct, @sessionVolumeUsd)
`);
const getWatchedCoins = db.prepare(`
  SELECT base FROM coin_lifecycle WHERE status IN ('qualifying', 'active', 'ghosted')
`);
const getPrevPrice = db.prepare(`
  SELECT price FROM coin_ticker_snapshot
  WHERE base = ? AND source = 'binance' AND ts < ?
  ORDER BY ts DESC LIMIT 1
`);

const MEANINGFUL_MOVE_PCT = 0.05; // noise floor for "did this coin actually move"

async function pollOnce() {
  const now = Date.now();
  const [binanceTickers, deltaTickers] = await Promise.all([
    binance.get24hrTickers().catch((e) => { console.error('Binance tickers failed:', e.message); return []; }),
    delta.getTickers().catch((e) => { console.error('Delta tickers failed:', e.message); return []; }),
  ]);

  const binanceBySymbol = new Map(binanceTickers.map((t) => [t.symbol, t]));
  const deltaBySymbol = new Map(deltaTickers.map((t) => [t.symbol, t]));

  let evaluated = 0;
  for (const coin of universe.coins) {
    const bt = binanceBySymbol.get(coin.binanceSymbol);
    const dt = coin.deltaSymbol ? deltaBySymbol.get(coin.deltaSymbol) : null;

    const price = bt ? Number(bt.lastPrice) : dt ? Number(dt.close) : null;
    const changePct24h = bt ? Number(bt.priceChangePercent) : dt ? Number(dt.ltp_change_24h) : null;
    const volumeUsd24h = bt ? Number(bt.quoteVolume) : dt ? Number(dt.turnover_usd) : null;
    const oiUsd = dt ? Number(dt.oi_value_usd) : null;
    const fundingRate = dt ? Number(dt.funding_rate) : null;

    if (bt) {
      insertSnapshot.run({ base: coin.base, ts: now, price, change_pct_24h: changePct24h, volume_usd_24h: volumeUsd24h, oi_usd: null, funding_rate: null, source: 'binance' });
    }
    if (dt) {
      insertSnapshot.run({ base: coin.base, ts: now, price: Number(dt.close), change_pct_24h: Number(dt.ltp_change_24h), volume_usd_24h: Number(dt.turnover_usd), oi_usd: oiUsd, funding_rate: fundingRate, source: 'delta' });
    }
    if (!bt && !dt) continue;
    evaluated += 1;

    const result = evaluateFilter(coin.base, { changePct24h, volumeUsd24h }, now);
    graduationGate.advance(coin.base, result.passes, now);

    const prev = getPrevPrice.get(coin.base, now);
    const movedMeaningfully = prev && price
      ? Math.abs((price - prev.price) / prev.price) * 100 >= MEANINGFUL_MOVE_PCT
      : false;
    ghostPrune.advance(coin.base, result.passes, movedMeaningfully, now);

    if (oiUsd != null) {
      const spike = checkOiSpike(coin.base, oiUsd);
      if (spike) {
        console.log(`[OI SPIKE] ${coin.base} ${spike.direction} ${spike.changePct.toFixed(1)}% vs baseline`);
      }
    }
  }

  const { qualifying, active } = graduationGate.counts();
  insertPulse.run(now, qualifying, active);
  console.log(`[poll] ${new Date(now).toISOString()} evaluated=${evaluated} qualifying=${qualifying} active=${active}`);

  await runIndicatorPass(now);
}

// Full validated indicator set (EMA200/RSI/ATR/RVOL, cascade, mega-spot,
// smart levels, session metrics) only for watched coins — not all 185 —
// to stay well under exchange rate limits. Sequential, not parallel: the
// watched set is small and this avoids bursting the API.
async function runIndicatorPass(now) {
  const watched = getWatchedCoins.all().map((r) => r.base);
  const universeByBase = new Map(universe.coins.map((c) => [c.base, c]));

  for (const base of watched) {
    const coin = universeByBase.get(base);
    if (!coin) continue;
    try {
      const snap = await computeFullSnapshot(coin.binanceSymbol);
      insertIndicatorSnapshot.run({
        base,
        ts: now,
        price: snap.price,
        ema200: JSON.stringify(snap.ema200),
        rsi14: JSON.stringify(snap.rsi14),
        atrPct: JSON.stringify(snap.atrPct),
        atr14: JSON.stringify(snap.atr14),
        rvol: JSON.stringify(snap.rvol),
        cascade: snap.cascade,
        counterCascade: snap.counterCascade,
        megaSpots: JSON.stringify(snap.megaSpots),
        smartLevels: JSON.stringify(snap.smartLevels),
        sessionChangePct: snap.sessionChangePct,
        sessionVolumeUsd: snap.sessionVolumeUsd,
      });
    } catch (e) {
      console.error(`[indicator pass] ${base} failed:`, e.message);
    }
  }
  if (watched.length) {
    console.log(`[indicator pass] computed for ${watched.length} watched coin(s): ${watched.join(', ')}`);
  }

  smartAlertsEvaluator.evaluateAll();
}

function start(intervalMs) {
  pollOnce().catch((e) => console.error('poll error:', e));
  return setInterval(() => { pollOnce().catch((e) => console.error('poll error:', e)); }, intervalMs);
}

module.exports = { start, pollOnce };
