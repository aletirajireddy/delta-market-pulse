const db = require('./db/database');
const universe = require('./data/coinUniverse.json');
const marketData = require('./services/marketData');
const delta = require('./services/exchanges/deltaClient');
const { getVolumeChangePct, buildResult } = require('./services/watchlist/filterEngine');
const graduationGate = require('./services/watchlist/graduationGate');
const ghostPrune = require('./services/watchlist/ghostPrune');
const { checkOiSpike } = require('./services/oiSpike');
const { checkAtrExpansion } = require('./services/atrExpansion');
const { computeFullSnapshot } = require('./services/indicatorEngine');
const smartAlertsEvaluator = require('./services/smartAlerts/evaluator');
const breadthScanner = require('./services/breadthScanner');
const volumeChangeCache = require('./services/volumeChangeCache');

const insertSnapshot = db.prepare(`
  INSERT OR REPLACE INTO coin_ticker_snapshot
    (base, ts, price, change_pct_24h, volume_usd_24h, oi_usd, funding_rate, source)
  VALUES (@base, @ts, @price, @change_pct_24h, @volume_usd_24h, @oi_usd, @funding_rate, @source)
`);
const insertPulse = db.prepare('INSERT OR REPLACE INTO watchlist_pulse (ts, qualifying_count, active_count) VALUES (?, ?, ?)');
const insertIndicatorSnapshot = db.prepare(`
  INSERT OR REPLACE INTO coin_indicator_snapshot
    (base, ts, price, ema200, rsi14, atrPct, atr14, rvol, adx, cascade, counterCascade, megaSpots, smartLevels, sessionChangePct, sessionVolumeUsd, consolidation, activeBreakout)
  VALUES (@base, @ts, @price, @ema200, @rsi14, @atrPct, @atr14, @rvol, @adx, @cascade, @counterCascade, @megaSpots, @smartLevels, @sessionChangePct, @sessionVolumeUsd, @consolidation, @activeBreakout)
`);
const getWatchedCoins = db.prepare(`
  SELECT base FROM coin_lifecycle WHERE status IN ('qualifying', 'active', 'ghosted')
`);
const getPrevPrice = db.prepare(`
  SELECT price FROM coin_ticker_snapshot
  WHERE base = ? AND source = ? AND ts < ?
  ORDER BY ts DESC LIMIT 1
`);

const MEANINGFUL_MOVE_PCT = 0.05; // noise floor for "did this coin actually move"
const VOLCHANGE_CONCURRENCY = 15; // parallel klines fetches for the 24h volume-change check — keeps a 185-coin pass well under a minute without bursting the API

// Runs `fn` over `items` with at most `limit` in flight at once. Used for
// the per-coin volume-change fetch (185 coins, each needs its own klines
// call) — fully sequential would take too long per poll cycle, fully
// parallel would burst the API for no reason given we have a 60s budget.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i).catch(() => null);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function pollOnce() {
  const now = Date.now();
  const [tickers, deltaTickers] = await Promise.all([
    marketData.fetchAllTickers(),
    delta.getTickers().catch((e) => { console.error('Delta tickers failed:', e.message); return []; }),
  ]);
  const deltaBySymbol = new Map(deltaTickers.map((t) => [t.symbol, t]));

  // Bulk-fetch every coin's 24h volume-change up front, concurrency-limited
  // — this is the one genuinely slow part (185 klines calls), done once
  // here rather than serially inline in the per-coin loop below.
  const volChangeResults = await mapWithConcurrency(
    universe.coins, VOLCHANGE_CONCURRENCY,
    (coin) => getVolumeChangePct(coin),
  );
  const volChangeByBase = new Map(universe.coins.map((c, i) => [c.base, volChangeResults[i]]));
  volumeChangeCache.set(volChangeByBase, now);

  let evaluated = 0;
  let oiSpikeCount = 0;
  for (const coin of universe.coins) {
    // Ticker pulled from the coin's PINNED source exchange (its original
    // watchlist exchange — never mixed with a different source mid-pipeline,
    // this is the direct fix for the XPL discrepancy).
    const st = marketData.getTickerForCoin(coin, tickers);
    const dt = coin.deltaSymbol ? deltaBySymbol.get(coin.deltaSymbol) : null;

    const price = st ? st.price : dt ? Number(dt.close) : null;
    const changePct24h = st ? st.changePct24h : dt ? Number(dt.ltp_change_24h) : null;
    const volumeUsd24h = st ? st.volumeUsd24h : dt ? Number(dt.turnover_usd) : null;
    // Delta stays separate and uniform for OI/funding regardless of the
    // coin's pinned source exchange — that's Delta's own derivatives data,
    // not tied to where the coin's spot/perp liquidity actually lives.
    const oiUsd = dt ? Number(dt.oi_value_usd) : null;
    const fundingRate = dt ? Number(dt.funding_rate) : null;

    if (st) {
      insertSnapshot.run({ base: coin.base, ts: now, price: st.price, change_pct_24h: st.changePct24h, volume_usd_24h: st.volumeUsd24h, oi_usd: null, funding_rate: null, source: coin.sourceExchange });
    }
    if (dt) {
      insertSnapshot.run({ base: coin.base, ts: now, price: Number(dt.close), change_pct_24h: Number(dt.ltp_change_24h), volume_usd_24h: Number(dt.turnover_usd), oi_usd: oiUsd, funding_rate: fundingRate, source: 'delta' });
    }
    if (!st && !dt) continue;
    evaluated += 1;

    // Filter is only ever evaluated against the coin's pinned exchange —
    // if that exchange had no ticker this cycle, skip evaluation entirely
    // rather than falling back to Delta (which would mix sources into the
    // same decision, the exact bug the exchange-pinning fix removed).
    const result = st && changePct24h != null && volumeUsd24h != null
      ? buildResult({ changePct24h, volumeUsd24h }, volChangeByBase.get(coin.base))
      : { passes: false, reasons: ['pinned exchange unavailable this cycle'] };
    graduationGate.advance(coin.base, result.passes, now);

    const prev = getPrevPrice.get(coin.base, coin.sourceExchange, now);
    const movedMeaningfully = prev && price
      ? Math.abs((price - prev.price) / prev.price) * 100 >= MEANINGFUL_MOVE_PCT
      : false;
    ghostPrune.advance(coin.base, result.passes, movedMeaningfully, now);

    if (oiUsd != null) {
      const spike = checkOiSpike(coin.base, oiUsd);
      if (spike) {
        oiSpikeCount += 1;
        console.log(`[OI SPIKE] ${coin.base} ${spike.direction} ${spike.changePct.toFixed(1)}% vs baseline`);
      }
    }
  }

  const { qualifying, active } = graduationGate.counts();
  insertPulse.run(now, qualifying, active);
  console.log(`[poll] ${new Date(now).toISOString()} evaluated=${evaluated} qualifying=${qualifying} active=${active}`);

  const breadth = breadthScanner.recordAndCheck(now, oiSpikeCount);
  if (breadth.burst) {
    console.log(`[MARKET BURST] ${breadth.burst.totalNow} coins surging/building, ${breadth.burst.multiplier.toFixed(1)}x baseline (${breadth.burst.baselineAvg.toFixed(1)})`);
  }

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
      const snap = await computeFullSnapshot(coin, now);
      insertIndicatorSnapshot.run({
        base,
        ts: now,
        price: snap.price,
        ema200: JSON.stringify(snap.ema200),
        rsi14: JSON.stringify(snap.rsi14),
        atrPct: JSON.stringify(snap.atrPct),
        atr14: JSON.stringify(snap.atr14),
        rvol: JSON.stringify(snap.rvol),
        adx: JSON.stringify(snap.adx),
        cascade: snap.cascade,
        counterCascade: snap.counterCascade,
        megaSpots: JSON.stringify(snap.megaSpots),
        smartLevels: JSON.stringify(snap.smartLevels),
        sessionChangePct: snap.sessionChangePct,
        sessionVolumeUsd: snap.sessionVolumeUsd,
        consolidation: JSON.stringify(snap.consolidation),
        activeBreakout: JSON.stringify(snap.activeBreakout),
      });

      for (const [tf, atrPct] of Object.entries(snap.atrPct)) {
        const expansion = checkAtrExpansion(base, tf, atrPct);
        if (expansion) {
          console.log(`[ATR EXPANSION] ${base} ${tf} ${expansion.multiplier.toFixed(1)}x baseline (${expansion.baseline.toFixed(2)}% -> ${expansion.current.toFixed(2)}%)`);
        }
      }
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
