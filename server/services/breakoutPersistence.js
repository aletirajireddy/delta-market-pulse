const db = require('../db/database');

// Mirrors Pine's bars_since_breakout persistence window (default 6 bars):
// a breakout signal stays "active" for N bars after it fires, not just the
// single instant it triggers. We evaluate per poll cycle, not per bar, so
// this converts the bar count to a time window per TF instead.
const TF_MINUTES = { m1: 1, m5: 5, m15: 15, m30: 30, h1: 60, h4: 240 };
const PERSISTENCE_BARS = 6;

const upsert = db.prepare(`
  INSERT INTO breakout_events (base, tf, direction, ts) VALUES (?, ?, ?, ?)
  ON CONFLICT(base, tf) DO UPDATE SET direction = excluded.direction, ts = excluded.ts
`);
const getLast = db.prepare('SELECT direction, ts FROM breakout_events WHERE base = ? AND tf = ?');

// breakoutUp/breakoutDown: this cycle's raw "just happened" booleans.
// Returns the currently-active breakout direction (or null), accounting
// for the persistence window even on cycles where nothing new fired.
function recordAndGetActive(base, tf, breakoutUp, breakoutDown, now) {
  if (breakoutUp) upsert.run(base, tf, 'up', now);
  else if (breakoutDown) upsert.run(base, tf, 'down', now);

  const last = getLast.get(base, tf);
  if (!last) return null;
  const windowMs = PERSISTENCE_BARS * (TF_MINUTES[tf] ?? 15) * 60_000;
  return (now - last.ts) <= windowMs ? last.direction : null;
}

module.exports = { recordAndGetActive };
