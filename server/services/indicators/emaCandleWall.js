// Backend data for the "EMA200 Candle Wall" widget (design confirmed
// against a screenshot of the concept): a per-coin candle whose BODY spans
// the long-series cascade (4h -> 1h -> 15m, same series cascade.js already
// classifies bull/bear/neutral on) and whose WICK is the fast counter
// series (5m -> 1m). The candle "expands" (price pushing past the 15m edge
// of the body) only counts as real extension when the counter series isn't
// contradicting it, filtered by 15m ATR as a noise floor — this is exactly
// the old project's Temp Bull / Temp Bear logic (CLAUDE.md "EMA Cascade
// Logic"), just rendered visually instead of only computed.

const { isCounterTrendReal } = require('./cascade');

// snap: one coin_indicator_snapshot row, already JSON-parsed.
function buildCandle(snap) {
  const { ema200, atr14, cascade, counterCascade, price } = snap;

  const bodyTop = Math.max(ema200.h4 ?? -Infinity, ema200.m15 ?? -Infinity);
  const bodyBottom = Math.min(ema200.h4 ?? Infinity, ema200.m15 ?? Infinity);
  const wickTop = Math.max(ema200.m5 ?? -Infinity, ema200.m1 ?? -Infinity);
  const wickBottom = Math.min(ema200.m5 ?? Infinity, ema200.m1 ?? Infinity);

  // "Beyond 15m" edge, in the cascade's own direction.
  const beyondBull = cascade === 'bull' && price != null && price > (ema200.m15 ?? Infinity);
  const beyondBear = cascade === 'bear' && price != null && price < (ema200.m15 ?? -Infinity);

  const atrM15 = atr14?.m15 ?? null;
  const counterReal = atrM15 != null && ema200.m5 != null && ema200.m1 != null
    ? isCounterTrendReal(ema200.m5, ema200.m1, atrM15)
    : false;
  // "No counter" = counter series doesn't have a real (non-noise) move
  // opposing the body's direction.
  const counterOpposes = (cascade === 'bull' && counterCascade === 'bear')
    || (cascade === 'bear' && counterCascade === 'bull');
  const expanded = (beyondBull || beyondBear) && !(counterOpposes && counterReal);

  // Gap% between each adjacent level in the stack, longest to shortest.
  const order = ['h4', 'h1', 'm15', 'm5', 'm1'];
  const gapPct = {};
  for (let i = 0; i < order.length - 1; i++) {
    const a = ema200[order[i]];
    const b = ema200[order[i + 1]];
    gapPct[`${order[i]}_${order[i + 1]}`] = (a != null && b != null && a !== 0)
      ? ((b - a) / a) * 100 : null;
  }

  return {
    base: snap.base,
    price,
    ema200,
    cascade,
    counterCascade,
    body: { top: isFinite(bodyTop) ? bodyTop : null, bottom: isFinite(bodyBottom) ? bodyBottom : null },
    wick: { top: isFinite(wickTop) ? wickTop : null, bottom: isFinite(wickBottom) ? wickBottom : null },
    expanded,
    gapPct,
    changePct: snap.sessionChangePct,
  };
}

module.exports = { buildCandle };
