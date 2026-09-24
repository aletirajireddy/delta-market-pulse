// Ported from tv-recommendation-fullstack's `/api/rsi-grid-wall` endpoint
// (server/index.js). Classifies a coin's multi-TF RSI stack into a cascade
// state (all series TFs oversold/overbought = full cascade, some = partial),
// plus a fast "temp TF" zone/direction and a pullback flag (cascade active
// but the fast TF has pulled back toward 50 — a common re-entry read).

const DEFAULTS = { seriesTfs: ['h1', 'm30'], tempTf: 'm15', oversold: 30, overbought: 70, pullbackZone: 5 };
const CASCADE_ORDER = { BEAR_CASCADE: 0, BULL_CASCADE: 1, PARTIAL_BEAR: 2, PARTIAL_BULL: 3, NEUTRAL: 4 };

function getZone(v, oversold, overbought) {
  if (v == null) return null;
  if (v < oversold) return 'oversold';
  if (v > overbought) return 'overbought';
  return 'middle';
}

// rsi/prevRsi: {m5,m15,m30,h1,h4} RSI14 values — current and previous cycle.
function classify(rsi, prevRsi, config = {}) {
  const { seriesTfs, tempTf, oversold, overbought, pullbackZone } = { ...DEFAULTS, ...config };

  const seriesZones = seriesTfs.map((tf) => getZone(rsi[tf], oversold, overbought));
  let cascadeState = 'NEUTRAL';
  if (seriesZones.every((z) => z === 'oversold')) cascadeState = 'BEAR_CASCADE';
  else if (seriesZones.every((z) => z === 'overbought')) cascadeState = 'BULL_CASCADE';
  else if (seriesZones.some((z) => z === 'oversold')) cascadeState = 'PARTIAL_BEAR';
  else if (seriesZones.some((z) => z === 'overbought')) cascadeState = 'PARTIAL_BULL';

  const tempRsi = rsi[tempTf];
  const prevTemp = prevRsi ? prevRsi[tempTf] : null;
  const tempZone = getZone(tempRsi, oversold, overbought);
  const tempDir = (tempRsi == null || prevTemp == null) ? 'flat'
    : tempRsi > prevTemp + 0.5 ? 'up'
      : tempRsi < prevTemp - 0.5 ? 'down' : 'flat';
  const prevTempZone = getZone(prevTemp, oversold, overbought);

  const cascadeActive = cascadeState === 'BEAR_CASCADE' || cascadeState === 'BULL_CASCADE';
  const pullback = cascadeActive && tempZone === 'middle'
    && tempRsi != null && Math.abs(tempRsi - 50) <= (pullbackZone + 5);

  const rsiDelta = {};
  const allTfs = [...new Set([...seriesTfs, tempTf])];
  for (const tf of allTfs) {
    const curr = rsi[tf];
    const prev = prevRsi ? prevRsi[tf] : null;
    rsiDelta[tf] = (curr != null && prev != null) ? +(curr - prev).toFixed(1) : null;
  }

  return { cascadeState, tempZone, tempDir, prevTempZone, pullback, rsiDelta };
}

function sortCoins(coins) {
  return [...coins].sort((a, b) => {
    const od = (CASCADE_ORDER[a.cascadeState] ?? 5) - (CASCADE_ORDER[b.cascadeState] ?? 5);
    return od !== 0 ? od : (b.pullback ? 1 : 0) - (a.pullback ? 1 : 0);
  });
}

module.exports = { classify, sortCoins, DEFAULTS };
