const db = require('../../db/database');
const { filter } = require('../../config/thresholds');

// 24h volume change: compare today's volume_usd_24h snapshot against the
// closest snapshot we have from ~24h ago. Returns null (not a guessed 0)
// when we don't have enough history yet — same "don't fabricate when the
// evidence isn't there" discipline as the old project's resolveVolumePulse.
function getVolumeChangePct(base, currentVolumeUsd, now) {
  const targetTs = now - 24 * 60 * 60 * 1000;
  const row = db.prepare(`
    SELECT volume_usd_24h, ts FROM coin_ticker_snapshot
    WHERE base = ? AND ts <= ?
    ORDER BY ts DESC LIMIT 1
  `).get(base, targetTs);
  if (!row || row.volume_usd_24h == null || row.volume_usd_24h === 0) return null;
  return ((currentVolumeUsd - row.volume_usd_24h) / row.volume_usd_24h) * 100;
}

// ticker: { changePct24h, volumeUsd24h }
function evaluateFilter(base, ticker, now) {
  if (ticker.changePct24h == null || ticker.volumeUsd24h == null) {
    return { passes: false, reasons: ['missing data'] };
  }
  const volChangePct = getVolumeChangePct(base, ticker.volumeUsd24h, now);

  const passChange = Math.abs(ticker.changePct24h) >= filter.minAbsChangePct;
  const passVolume = ticker.volumeUsd24h >= filter.minVolumeUsd;
  const passVolChange = volChangePct != null && volChangePct >= filter.minVolumeChangePct;

  return {
    passes: passChange && passVolume && passVolChange,
    passChange,
    passVolume,
    passVolChange,
    volChangePct,
  };
}

module.exports = { evaluateFilter, getVolumeChangePct };
