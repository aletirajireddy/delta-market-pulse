const db = require('../../db/database');
const service = require('./service');

const getLatestIndicator = db.prepare(`
  SELECT ema200, atrPct FROM coin_indicator_snapshot WHERE base = ? ORDER BY ts DESC LIMIT 1
`);
const getLatestPrice = db.prepare(`
  SELECT price FROM coin_ticker_snapshot WHERE base = ? AND source = 'binance' ORDER BY ts DESC LIMIT 1
`);

// Called once per poll cycle (after the indicator pass, so this cycle's
// EMA200/ATR are fresh for any base with an active alert).
function evaluateAll() {
  const alerts = service.listEvaluable();
  if (!alerts.length) return;

  const now = Date.now();
  const stillActive = [];
  for (const a of alerts) {
    if (a.expires_at && a.expires_at < now) {
      service.recordExpiry(a);
    } else {
      stillActive.push(a);
    }
  }
  if (!stillActive.length) return;

  for (const a of stillActive) {
    const ind = getLatestIndicator.get(a.base);
    const priceRow = getLatestPrice.get(a.base);
    if (!ind || !priceRow) continue;

    const ema200 = JSON.parse(ind.ema200);
    const atrPct = JSON.parse(ind.atrPct);
    const ema = ema200[a.timeframe];
    const atr = atrPct[a.timeframe];
    const price = priceRow.price;
    if (price == null || ema == null) continue;

    const newSide = service.sideOf(price, ema);
    const distAtr = service.deltaAtr(price, ema, atr);
    const triggers = a.triggers || [];
    const params = a.params || {};

    let firedType = null;
    // Order: touch > cross > approach — strongest signal wins per tick.
    if (triggers.includes('touch') && distAtr != null && distAtr <= (params.touch_atr ?? service.DEFAULT_TOUCH_ATR)) {
      firedType = 'touch';
    } else if (triggers.includes('cross') && a.last_side && newSide && a.last_side !== newSide
      && (a.last_side === 'above' || a.last_side === 'below') && (newSide === 'above' || newSide === 'below')) {
      firedType = 'cross';
    } else if (triggers.includes('approach') && distAtr != null && distAtr <= (params.approach_atr ?? service.defaultApproachAtr(a.timeframe))) {
      firedType = 'approach';
    }

    if (firedType && a.params?.recurring && a.last_qualified_at) {
      const cooldownMs = (params.cooldown_min ?? service.DEFAULT_COOLDOWN_MIN) * 60_000;
      if (now - a.last_qualified_at < cooldownMs) firedType = null;
    }

    if (firedType) {
      service.recordTrigger({ alert: a, eventType: firedType, price, ema, atr });
      console.log(`[smart alert] ${a.base} ${a.timeframe} ${firedType.toUpperCase()} EMA200 @ ${price}`);
    }

    service.recordEvaluation({ id: a.id, ts: now, price, ema, atr, side: newSide });
  }
}

module.exports = { evaluateAll };
