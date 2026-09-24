const { megaClusterThresholdPct, megaAtThresholdPct } = require('../../config/thresholds');

// Ported from tradingview_scanning_indicator.js's Mega Spot Detection
// (Column 25/26 logic). Greedily clusters the 4 EMA200 timeframes that sit
// within `megaClusterThresholdPct` of each other; each cluster's average
// price is a "mega spot". Faithful to the Pine source, not a reinterpretation.
//
// emas: { m5, m15, h1, h4 } EMA200 values (nulls allowed, tf skipped if null)
function findMegaSpots(emas) {
  const tfs = ['m5', 'm15', 'h1', 'h4'];
  const values = tfs.map((tf) => emas[tf]);
  const allValid = values.every((v) => v != null && v > 0);
  if (!allValid) return [];

  const inCluster = [false, false, false, false];
  const spots = [];

  for (let i = 0; i < 4; i++) {
    if (inCluster[i]) continue;
    const members = [values[i]];
    const indices = [i];
    for (let j = i + 1; j < 4; j++) {
      if (inCluster[j]) continue;
      const distPct = Math.abs((values[i] - values[j]) / values[i]) * 100;
      if (distPct <= megaClusterThresholdPct) {
        members.push(values[j]);
        indices.push(j);
      }
    }
    if (members.length >= 2) {
      indices.forEach((idx) => { inCluster[idx] = true; });
      const price = members.reduce((a, b) => a + b, 0) / members.length;
      spots.push({ price, count: members.length, tfs: indices.map((idx) => tfs[idx]) });
    }
  }
  return spots;
}

function nearestMegaSpot(spots, close) {
  if (!spots.length) return null;
  let best = spots[0];
  let bestDist = Math.abs(spots[0].price - close);
  for (const s of spots.slice(1)) {
    const d = Math.abs(s.price - close);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return { ...best, distPct: close > 0 ? ((best.price - close) / close) * 100 : null };
}

// Ported from the Pine source's EMA Position Code (Column 26): a 3-digit
// XYZ code. X = position type (5=at mega spot, 4=at a single EMA200,
// 1=below all, 3=above all, 2=between, 0=no data). Y = count below price,
// Z = count above price. See tradingview_scanning_indicator.js:191-214 for
// the full priority ranking this is meant to reproduce exactly.
function emaPositionCode(emas, close) {
  const tfs = ['m5', 'm15', 'h1', 'h4'];
  const values = tfs.map((tf) => emas[tf]);
  const allValid = values.every((v) => v != null && v > 0) && close > 0;
  if (!allValid) return { code: 0, posType: 0, emasBelow: 0, emasAbove: 0, emasAt: 0 };

  let emasBelow = 0, emasAbove = 0, emasAt = 0;
  for (const v of values) {
    const distPct = Math.abs((v - close) / close) * 100;
    if (distPct <= megaAtThresholdPct) emasAt += 1;
    else if (v < close) emasBelow += 1;
    else emasAbove += 1;
  }

  const spots = findMegaSpots(emas);
  let atMega = false;
  for (const s of spots) {
    const distPct = Math.abs((s.price - close) / close) * 100;
    if (distPct <= megaAtThresholdPct) { atMega = true; break; }
  }

  let posType;
  if (atMega) posType = 5;
  else if (emasAt > 0) posType = 4;
  else if (emasBelow === 0 && emasAbove > 0) posType = 1;
  else if (emasBelow > 0 && emasAbove > 0) posType = 2;
  else if (emasBelow > 0 && emasAbove === 0) posType = 3;
  else posType = 0;

  const code = posType * 100 + emasBelow * 10 + emasAbove;
  return { code, posType, emasBelow, emasAbove, emasAt };
}

module.exports = { findMegaSpots, nearestMegaSpot, emaPositionCode };
