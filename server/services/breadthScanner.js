const db = require('../db/database');
const momentumScanner = require('./momentumScanner');

// Replaces Stream C's "many alerts across many coins at once = market-wide
// event" burst-clustering logic (see momentumScanner.js's header comment
// for the full reasoning). Instead of counting webhook alerts, this counts
// how many DISTINCT coins are currently SURGING/BUILDING (momentumScanner)
// or OI-spiking, then compares that breadth count to its own recent
// baseline — same "don't fabricate, compare to your own history" pattern
// used everywhere else (resolveVolumePulse, OI spike baseline).

const insertBreadth = db.prepare(`
  INSERT OR REPLACE INTO breadth_snapshot (ts, surging_count, building_count, oi_spike_count)
  VALUES (?, ?, ?, ?)
`);
const getRecentBreadth = db.prepare(`
  SELECT surging_count, building_count FROM breadth_snapshot WHERE ts >= ? AND ts < ? ORDER BY ts ASC
`);

const BASELINE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h trailing baseline
const MIN_BASELINE_SAMPLES = 5;
const BURST_MULTIPLIER = 2; // current breadth >= 2x its own recent baseline

function recordAndCheck(now, oiSpikeCount = 0) {
  const momentum = momentumScanner.scan(now);
  const surgingCount = momentum.filter((c) => c.signal === 'SURGING').length;
  const buildingCount = momentum.filter((c) => c.signal === 'BUILDING').length;

  insertBreadth.run(now, surgingCount, buildingCount, oiSpikeCount);

  const since = now - BASELINE_WINDOW_MS;
  const history = getRecentBreadth.all(since, now);
  const totalNow = surgingCount + buildingCount;

  let burst = null;
  if (history.length >= MIN_BASELINE_SAMPLES) {
    const baselineAvg = history.reduce((s, r) => s + r.surging_count + r.building_count, 0) / history.length;
    if (baselineAvg > 0 && totalNow >= baselineAvg * BURST_MULTIPLIER) {
      burst = { totalNow, baselineAvg, multiplier: totalNow / baselineAvg };
    }
  }

  return { surgingCount, buildingCount, oiSpikeCount, coins: momentum, burst };
}

module.exports = { recordAndCheck };
