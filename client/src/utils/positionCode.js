// Client-side port of server/services/indicators/emaClustering.js's
// computePositionCode/findPositionCodeCluster — itself a verified port of
// the old app's Stream A Pine Script Column 26 (EMA Position Code).
//
// This is the SIGNAL that actually drives the old app's market-wide mood/
// breadth (traced 2026-09-26 through both its authoritative locations:
// server/index.js's ingress "Genie Truth" recalculation, line ~348, and
// the client's GenieSmart.analyzeMarketMood() — both independently use
// positionCode >= 300 = bullish, 100-199 = bearish, identically). The
// per-coin composite `calculateGenieScore()` found in the same server
// file is a DIFFERENT thing — a 6-factor arbitrary-weighted setup-quality
// ranking score, never used for market mood, and deliberately NOT ported
// here (same anti-composite-score principle this project already follows
// — see ARCHITECTURE_DECISIONS.md §7).
const MEGA_CLUSTER_THRESHOLD_PCT = 0.25;
const MEGA_AT_THRESHOLD_PCT = 0.15;

function findPositionCodeCluster(emas) {
  const tfs = ['m5', 'm15', 'h1', 'h4'];
  const values = tfs.map((tf) => emas[tf]);
  const allValid = values.every((v) => v != null && v > 0);
  if (!allValid) return [];

  const inCluster = [false, false, false, false];
  const clusters = [];

  for (let i = 0; i < 4; i++) {
    if (inCluster[i]) continue;
    const members = [values[i]];
    const indices = [i];
    for (let j = i + 1; j < 4; j++) {
      if (inCluster[j]) continue;
      const distPct = Math.abs((values[i] - values[j]) / values[i]) * 100;
      if (distPct <= MEGA_CLUSTER_THRESHOLD_PCT) {
        members.push(values[j]);
        indices.push(j);
      }
    }
    if (members.length >= 2) {
      indices.forEach((idx) => { inCluster[idx] = true; });
      const price = members.reduce((a, b) => a + b, 0) / members.length;
      clusters.push({ price, count: members.length, tfs: indices.map((idx) => tfs[idx]) });
    }
  }
  return clusters;
}

// emas: {m5,m15,h1,h4} EMA200 values for one coin. Returns posType:
// 5=at position-code cluster, 4=at a single EMA200, 3=above all (bullish),
// 2=between (neutral), 1=below all (bearish), 0=no data.
export function computePositionCode(emas, close) {
  const tfs = ['m5', 'm15', 'h1', 'h4'];
  const values = tfs.map((tf) => emas?.[tf]);
  const allValid = values.every((v) => v != null && v > 0) && close > 0;
  if (!allValid) return { code: 0, posType: 0, emasBelow: 0, emasAbove: 0, emasAt: 0 };

  let emasBelow = 0, emasAbove = 0, emasAt = 0;
  for (const v of values) {
    const distPct = Math.abs((v - close) / close) * 100;
    if (distPct <= MEGA_AT_THRESHOLD_PCT) emasAt += 1;
    else if (v < close) emasBelow += 1;
    else emasAbove += 1;
  }

  const clusters = findPositionCodeCluster(emas);
  let atCluster = false;
  for (const cl of clusters) {
    const distPct = Math.abs((cl.price - close) / close) * 100;
    if (distPct <= MEGA_AT_THRESHOLD_PCT) { atCluster = true; break; }
  }

  let posType;
  if (atCluster) posType = 5;
  else if (emasAt > 0) posType = 4;
  else if (emasBelow === 0 && emasAbove > 0) posType = 1;
  else if (emasBelow > 0 && emasAbove > 0) posType = 2;
  else if (emasBelow > 0 && emasAbove === 0) posType = 3;
  else posType = 0;

  const code = posType * 100 + emasBelow * 10 + emasAbove;
  return { code, posType, emasBelow, emasAbove, emasAt };
}

// posType 3 (price above all 4 TF EMA200s) = bullish, posType 1 (below
// all) = bearish, everything else (2/4/5/0) = neutral — same bucketing
// as GenieSmart.analyzeMarketMood()'s positionCode >= 300 / 100-199 check.
export function positionCodeDirection(posType) {
  if (posType === 3) return 'bull';
  if (posType === 1) return 'bear';
  return 'neutral';
}
