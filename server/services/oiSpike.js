const db = require('../db/database');
const { oiSpike } = require('../config/thresholds');

const getBaseline = db.prepare('SELECT samples FROM oi_baseline WHERE base = ?');
const upsertBaseline = db.prepare(`
  INSERT INTO oi_baseline (base, samples) VALUES (?, ?)
  ON CONFLICT(base) DO UPDATE SET samples = excluded.samples
`);

const MAX_SAMPLES = 30; // rolling baseline window

// Same shape as the old project's RVOL-spike detection (VolumeEventService),
// applied to open interest instead. Returns null (no fabricated signal)
// until there's enough baseline history.
function checkOiSpike(base, currentOiUsd) {
  const row = getBaseline.get(base);
  const samples = row ? JSON.parse(row.samples) : [];

  let spike = null;
  if (samples.length >= oiSpike.minBaselineSamples) {
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const changePct = avg ? ((currentOiUsd - avg) / avg) * 100 : null;
    if (changePct != null && Math.abs(changePct) >= oiSpike.spikeThresholdPct) {
      spike = { direction: changePct > 0 ? 'up' : 'down', changePct, baseline: avg };
    }
  }

  const updated = [...samples, currentOiUsd].slice(-MAX_SAMPLES);
  upsertBaseline.run(base, JSON.stringify(updated));

  return spike;
}

module.exports = { checkOiSpike };
