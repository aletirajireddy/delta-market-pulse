const marketData = require('../marketData');
const { filter } = require('../../config/thresholds');

// 24h volume change, sourced directly from the coin's pinned exchange's own
// historical candles — never our own accumulated snapshot history. The
// exchange already holds 48h of hourly data at any moment, so there's no
// "wait 24h for our own baseline to warm up" problem: sum the last 24
// hourly candles as "current" volume, the 24 before that as "baseline",
// same method proven in every live validation check this session. Returns
// null (not a guessed number) only if the exchange itself doesn't have
// enough history for this symbol (e.g. a very recent listing).
// asOf: only pass this for historical/validation checks against a past
// moment — live operation should omit it so this fetches truly the latest
// candles, matching every live validation check already done this session.
async function getVolumeChangePct(coin, asOf) {
  const kl = await marketData.getKlinesForCoin(coin, '1h', 48, asOf);
  if (!kl || kl.length < 48) return null;

  const quoteVolIdx = coin.sourceExchange === 'bybit' ? 6 : 7;
  const curr24 = kl.slice(24);
  const prior24 = kl.slice(0, 24);
  const currVol = curr24.reduce((s, k) => s + Number(k[quoteVolIdx]), 0);
  const priorVol = prior24.reduce((s, k) => s + Number(k[quoteVolIdx]), 0);

  if (!priorVol) return null;
  return ((currVol - priorVol) / priorVol) * 100;
}

// Pure threshold comparison, no network — split out so a caller that's
// already bulk-fetched volChangePct (e.g. the poller, with concurrency
// control across 185 coins) doesn't need to re-fetch per coin.
function buildResult(ticker, volChangePct) {
  const passChange = Math.abs(ticker.changePct24h) >= filter.minAbsChangePct;
  const passVolume = ticker.volumeUsd24h >= filter.minVolumeUsd;
  const passVolChange = volChangePct != null && volChangePct >= filter.minVolumeChangePct;
  return {
    passes: passChange && passVolume && passVolChange,
    passChange, passVolume, passVolChange, volChangePct,
  };
}

// ticker: { changePct24h, volumeUsd24h } — from the coin's pinned exchange's
// live 24hr ticker (never Delta or a different exchange — same discipline
// as everywhere else, see marketData.js). Convenience wrapper for callers
// evaluating one coin at a time (not the poller's bulk path).
async function evaluateFilter(coin, ticker) {
  if (ticker.changePct24h == null || ticker.volumeUsd24h == null) {
    return { passes: false, reasons: ['missing data'] };
  }
  const volChangePct = await getVolumeChangePct(coin);
  return buildResult(ticker, volChangePct);
}

module.exports = { evaluateFilter, getVolumeChangePct, buildResult };
