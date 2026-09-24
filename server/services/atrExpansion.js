const db = require('../db/database');

// Direction-agnostic volatility-expansion signal: is this coin's ATR% on a
// given TF meaningfully higher than its own recent baseline right now?
// Same rolling-baseline shape as oiSpike.js — genuinely new information
// (RVOL says "more volume than usual", this says "bigger true-range moves
// than usual" — the two don't always move together).

const getBaseline = db.prepare('SELECT samples FROM atr_baseline WHERE base = ? AND tf = ?');
const upsertBaseline = db.prepare(`
  INSERT INTO atr_baseline (base, tf, samples) VALUES (?, ?, ?)
  ON CONFLICT(base, tf) DO UPDATE SET samples = excluded.samples
`);

const MAX_SAMPLES = 30;
const MIN_BASELINE_SAMPLES = 5;
const EXPANSION_MULTIPLIER = 1.5; // current ATR% >= 1.5x its own recent baseline

function checkAtrExpansion(base, tf, currentAtrPct) {
  if (currentAtrPct == null) return null;
  const row = getBaseline.get(base, tf);
  const samples = row ? JSON.parse(row.samples) : [];

  let expansion = null;
  if (samples.length >= MIN_BASELINE_SAMPLES) {
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (avg > 0 && currentAtrPct >= avg * EXPANSION_MULTIPLIER) {
      expansion = { multiplier: currentAtrPct / avg, baseline: avg, current: currentAtrPct };
    }
  }

  const updated = [...samples, currentAtrPct].slice(-MAX_SAMPLES);
  upsertBaseline.run(base, tf, JSON.stringify(updated));
  return expansion;
}

module.exports = { checkAtrExpansion };
