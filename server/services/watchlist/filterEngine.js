const db = require('../../db/database');
const marketData = require('../marketData');
const { filter } = require('../../config/thresholds');

// Primary: 24h volume change sourced directly from the coin's pinned
// exchange's own historical candles — no warmup needed, always available
// once the exchange itself has 48h of history for the symbol.
//
// Fallback (cheap — no extra API call): if the exchange fetch fails (a
// transient outage outlasting the retry/backoff, or a genuinely new
// listing), fall back to comparing against our OWN accumulated
// coin_ticker_snapshot history from ~24h ago. This degrades gracefully
// instead of going blank — the exact gap flagged after the exchange-native
// switch: that switch traded "needs 24h warmup" for "needs the exchange up
// every cycle," and this fallback removes that new single point of failure
// without reintroducing the original warmup problem (the fallback is only
// ever used when the primary path fails, not by default).
//
// currentVolumeUsd: this cycle's live volume, needed only for the fallback
// path (the primary path computes both current and baseline from the same
// klines fetch, so it doesn't need this).
async function getVolumeChangePct(coin, currentVolumeUsd) {
  try {
    const kl = await marketData.getKlinesForCoin(coin, '1h', 48);
    if (kl && kl.length >= 48) {
      const quoteVolIdx = coin.sourceExchange === 'bybit' ? 6 : 7;
      const curr24 = kl.slice(24);
      const prior24 = kl.slice(0, 24);
      const currVol = curr24.reduce((s, k) => s + Number(k[quoteVolIdx]), 0);
      const priorVol = prior24.reduce((s, k) => s + Number(k[quoteVolIdx]), 0);
      if (priorVol) return { value: ((currVol - priorVol) / priorVol) * 100, source: 'exchange' };
    }
  } catch (e) {
    // fall through to the backup path below
  }

  if (currentVolumeUsd != null) {
    const row = db.prepare(`
      SELECT volume_usd_24h FROM coin_ticker_snapshot
      WHERE base = ? AND source = ? AND ts <= ?
      ORDER BY ts DESC LIMIT 1
    `).get(coin.base, coin.sourceExchange, Date.now() - 24 * 60 * 60 * 1000);
    if (row && row.volume_usd_24h) {
      return { value: ((currentVolumeUsd - row.volume_usd_24h) / row.volume_usd_24h) * 100, source: 'inhouse_fallback' };
    }
  }

  return { value: null, source: 'unavailable' };
}

// Pure threshold comparison, no network — split out so a caller that's
// already bulk-fetched volChangePct (e.g. the poller, with concurrency
// control across 185 coins) doesn't need to re-fetch per coin.
function buildResult(ticker, volChange) {
  const volChangePct = volChange?.value ?? null;
  const passChange = Math.abs(ticker.changePct24h) >= filter.minAbsChangePct;
  const passVolume = ticker.volumeUsd24h >= filter.minVolumeUsd;
  const passVolChange = volChangePct != null && volChangePct >= filter.minVolumeChangePct;
  return {
    passes: passChange && passVolume && passVolChange,
    passChange, passVolume, passVolChange, volChangePct,
    volChangeSource: volChange?.source ?? 'unavailable',
  };
}

// ticker: { changePct24h, volumeUsd24h } — from the coin's pinned exchange's
// live 24hr ticker. Convenience wrapper for callers evaluating one coin at
// a time (not the poller's bulk path).
async function evaluateFilter(coin, ticker) {
  if (ticker.changePct24h == null || ticker.volumeUsd24h == null) {
    return { passes: false, reasons: ['missing data'] };
  }
  const volChange = await getVolumeChangePct(coin, ticker.volumeUsd24h);
  return buildResult(ticker, volChange);
}

module.exports = { evaluateFilter, getVolumeChangePct, buildResult };
