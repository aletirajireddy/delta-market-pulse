const db = require('../db/database');
const universe = require('../data/coinUniverse.json');
const volumeChangeCache = require('./volumeChangeCache');

// Replaces the old project's institutional-alert-driven "macro" pulse (dead
// since the institutional feed stopped in the old system) with a pure
// volume/momentum scanner over the FULL 185-coin universe — not just the
// watched set — since it only needs the ticker snapshots already collected
// every poll cycle (no extra API calls). This is the "which coins are
// genuinely moving with volume behind them right now" view.
//
// Tiers (deliberately simple, no composite score — raw thresholds only):
//   SURGING: big price move AND big volume-change, both directions align
//   BUILDING: real volume-change but price move still modest
//   QUIET: neither condition met
const SURGE_CHANGE_PCT = 3;
const SURGE_VOLCHANGE_PCT = 50;
const BUILD_VOLCHANGE_PCT = 20;

const getLatest = db.prepare(`
  SELECT * FROM coin_ticker_snapshot
  WHERE base = ? AND source = ?
  ORDER BY ts DESC LIMIT 1
`);

function scan(now = Date.now()) {
  const results = [];
  for (const coin of universe.coins) {
    const row = getLatest.get(coin.base, coin.sourceExchange);
    if (!row || row.change_pct_24h == null || row.volume_usd_24h == null) continue;

    const volChangePct = volumeChangeCache.get(coin.base);
    const changePct = row.change_pct_24h;

    let signal = 'QUIET';
    if (Math.abs(changePct) >= SURGE_CHANGE_PCT && volChangePct != null && volChangePct >= SURGE_VOLCHANGE_PCT) {
      signal = 'SURGING';
    } else if (volChangePct != null && volChangePct >= BUILD_VOLCHANGE_PCT) {
      signal = 'BUILDING';
    }

    if (signal === 'QUIET') continue; // only surface coins actually doing something
    results.push({
      base: coin.base,
      price: row.price,
      changePct,
      volumeUsd: row.volume_usd_24h,
      volChangePct,
      signal,
      ts: row.ts,
    });
  }

  results.sort((a, b) => {
    const order = { SURGING: 0, BUILDING: 1 };
    const o = order[a.signal] - order[b.signal];
    return o !== 0 ? o : (b.volChangePct ?? 0) - (a.volChangePct ?? 0);
  });
  return results;
}

module.exports = { scan };
