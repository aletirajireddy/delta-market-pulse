// Ported from tv-recommendation-fullstack's smart-alerts service. EMA200
// proximity alerts: approach (within N x ATR), touch (very close), cross
// (side flip). No external notification channel yet (no Telegram/push) —
// qualified state + event history is the delivery mechanism for v1; add a
// channel later if wanted, this doesn't block on that.

const { randomUUID } = require('crypto');
const db = require('../../db/database');

const TFS = ['m5', 'm15', 'm30', 'h1', 'h4'];
const VALID_TRIGGERS = ['approach', 'touch', 'cross'];
const DEFAULT_APPROACH_ATR_BY_TF = { m5: 0.25, m15: 0.45, m30: 0.45, h1: 0.45, h4: 0.55 };
const DEFAULT_APPROACH_ATR = 0.45;
const DEFAULT_TOUCH_ATR = 0.10;
const DEFAULT_COOLDOWN_MIN = 15;
const DEFAULT_EXPIRY_HOURS = 24;

function defaultApproachAtr(tf) {
  return DEFAULT_APPROACH_ATR_BY_TF[tf] ?? DEFAULT_APPROACH_ATR;
}

const stmts = {
  insert: db.prepare(`
    INSERT INTO smart_alerts (id, created_at, updated_at, enabled, base, timeframe,
      triggers_json, params_json, state, expires_at, last_price, last_ema, last_atr, last_side)
    VALUES (@id, @created_at, @updated_at, 1, @base, @timeframe,
      @triggers_json, @params_json, 'active', @expires_at, @last_price, @last_ema, @last_atr, @last_side)
  `),
  insertEvent: db.prepare(`
    INSERT INTO smart_alert_events (alert_id, ts, event_type, price, ema, atr, distance_pct, distance_atr, message)
    VALUES (@alert_id, @ts, @event_type, @price, @ema, @atr, @distance_pct, @distance_atr, @message)
  `),
  updateAfterEval: db.prepare(`
    UPDATE smart_alerts SET last_evaluated_at=@ts, last_price=@price, last_ema=@ema, last_atr=@atr, last_side=@side, updated_at=@ts
    WHERE id=@id
  `),
  markQualified: db.prepare(`
    UPDATE smart_alerts SET state='qualified', enabled=@enabled, qualified_count=qualified_count+1, last_qualified_at=@ts, updated_at=@ts
    WHERE id=@id
  `),
  markExpired: db.prepare(`UPDATE smart_alerts SET state='expired', enabled=0, updated_at=@ts WHERE id=@id`),
  setEnabled: db.prepare(`UPDATE smart_alerts SET enabled=@enabled, state=@state, updated_at=@ts WHERE id=@id`),
  softDelete: db.prepare(`UPDATE smart_alerts SET deleted_at=@ts, enabled=0, updated_at=@ts WHERE id=@id AND deleted_at IS NULL`),
  markRead: db.prepare(`UPDATE smart_alerts SET acknowledged_at=@ts, updated_at=@ts WHERE id=@id`),
  markAllRead: db.prepare(`
    UPDATE smart_alerts SET acknowledged_at=@ts, updated_at=@ts
    WHERE state='qualified' AND deleted_at IS NULL AND (acknowledged_at IS NULL OR acknowledged_at < last_qualified_at)
  `),
  getById: db.prepare(`SELECT * FROM smart_alerts WHERE id=?`),
  listAll: db.prepare(`SELECT * FROM smart_alerts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`),
  listByState: db.prepare(`SELECT * FROM smart_alerts WHERE deleted_at IS NULL AND state=? ORDER BY created_at DESC LIMIT ?`),
  listAllActive: db.prepare(`SELECT * FROM smart_alerts WHERE deleted_at IS NULL AND state='active' AND enabled=1`),
  eventsForAlert: db.prepare(`SELECT * FROM smart_alert_events WHERE alert_id=? ORDER BY id DESC LIMIT ?`),
  unreadQualifiedCount: db.prepare(`
    SELECT COUNT(*) AS n FROM smart_alerts
    WHERE deleted_at IS NULL AND state='qualified' AND (acknowledged_at IS NULL OR acknowledged_at < last_qualified_at)
  `),
  bulkDeleteByState: db.prepare(`
    UPDATE smart_alerts SET deleted_at=@ts, enabled=0, updated_at=@ts
    WHERE deleted_at IS NULL AND (state=@state OR @state='all')
  `),
};

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    enabled: !!row.enabled,
    triggers: safeJSON(row.triggers_json, []),
    params: safeJSON(row.params_json, {}),
    is_unread: row.state === 'qualified' && (!row.acknowledged_at || row.acknowledged_at < row.last_qualified_at),
  };
}
function safeJSON(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

function createAlert(input) {
  if (!input.base) throw new Error('base is required');
  if (!TFS.includes(input.timeframe)) throw new Error(`Invalid timeframe: ${input.timeframe}`);
  const triggers = Array.isArray(input.triggers) ? input.triggers.filter((t) => VALID_TRIGGERS.includes(t)) : [];
  if (!triggers.length) throw new Error('At least one trigger required (approach|touch|cross)');

  const params = {
    approach_atr: clampNum(input.approach_atr, 0.05, 5, DEFAULT_APPROACH_ATR),
    touch_atr: clampNum(input.touch_atr, 0.01, 1, DEFAULT_TOUCH_ATR),
    recurring: !!input.recurring,
    cooldown_min: clampNum(input.cooldown_min, 1, 240, DEFAULT_COOLDOWN_MIN),
    expiry_hours: input.expiry_hours == null ? DEFAULT_EXPIRY_HOURS : clampNum(input.expiry_hours, 0, 168, DEFAULT_EXPIRY_HOURS),
    note: (input.note || '').toString().slice(0, 280) || null,
  };

  const now = Date.now();
  const id = randomUUID();
  const expiresAt = params.expiry_hours > 0 ? now + params.expiry_hours * 3600_000 : null;
  const initialSide = input.last_price != null && input.last_ema != null
    ? (input.last_price > input.last_ema ? 'above' : input.last_price < input.last_ema ? 'below' : 'at')
    : null;

  stmts.insert.run({
    id, created_at: now, updated_at: now,
    base: input.base.toUpperCase(), timeframe: input.timeframe,
    triggers_json: JSON.stringify(triggers), params_json: JSON.stringify(params),
    expires_at: expiresAt,
    last_price: input.last_price ?? null, last_ema: input.last_ema ?? null, last_atr: input.last_atr ?? null,
    last_side: initialSide,
  });

  stmts.insertEvent.run({
    alert_id: id, ts: now, event_type: 'created',
    price: input.last_price ?? null, ema: input.last_ema ?? null, atr: input.last_atr ?? null,
    distance_pct: deltaPct(input.last_price, input.last_ema),
    distance_atr: deltaAtr(input.last_price, input.last_ema, input.last_atr),
    message: `Created · triggers=[${triggers.join(',')}] · EMA200 ${input.timeframe}`,
  });

  return getById(id);
}

function getById(id) { return hydrate(stmts.getById.get(id)); }
function list({ state = 'all', limit = 200 } = {}) {
  const cap = Math.min(500, Math.max(1, limit));
  const rows = state === 'all' ? stmts.listAll.all(cap) : stmts.listByState.all(state, cap);
  return rows.map(hydrate);
}
function listEvaluable() { return stmts.listAllActive.all().map(hydrate); }
function getEvents(alertId, limit = 100) { return stmts.eventsForAlert.all(alertId, limit); }

function setEnabled(id, enabled) {
  const row = stmts.getById.get(id);
  if (!row) throw new Error('not found');
  const ts = Date.now();
  const newState = enabled ? (row.state === 'expired' || row.state === 'qualified' ? 'active' : row.state) : row.state;
  stmts.setEnabled.run({ id, enabled: enabled ? 1 : 0, state: newState, ts });
  stmts.insertEvent.run({
    alert_id: id, ts, event_type: enabled ? 'enabled' : 'disabled',
    price: null, ema: null, atr: null, distance_pct: null, distance_atr: null, message: null,
  });
  return getById(id);
}

function softDelete(id) { const ts = Date.now(); const r = stmts.softDelete.run({ id, ts }); return r.changes > 0; }
function markRead(id) { stmts.markRead.run({ id, ts: Date.now() }); return getById(id); }
function markAllRead() { return stmts.markAllRead.run({ ts: Date.now() }); }
function bulkDelete(scope = 'expired') { return stmts.bulkDeleteByState.run({ state: scope, ts: Date.now() }); }
function unreadQualifiedCount() { return stmts.unreadQualifiedCount.get().n; }

function recordEvaluation({ id, ts, price, ema, atr, side }) {
  stmts.updateAfterEval.run({ id, ts, price, ema, atr, side });
}
function recordTrigger({ alert, eventType, price, ema, atr }) {
  const ts = Date.now();
  const dPct = deltaPct(price, ema);
  const dAtr = deltaAtr(price, ema, atr);
  stmts.insertEvent.run({
    alert_id: alert.id, ts, event_type: eventType,
    price, ema, atr, distance_pct: dPct, distance_atr: dAtr,
    message: `${eventType.toUpperCase()} · Δ=${dPct?.toFixed(3)}% (${dAtr?.toFixed(2)}x ATR)`,
  });
  const recurring = alert.params?.recurring;
  stmts.markQualified.run({ id: alert.id, enabled: recurring ? 1 : 0, ts });
}
function recordExpiry(alert) {
  const ts = Date.now();
  stmts.markExpired.run({ id: alert.id, ts });
  stmts.insertEvent.run({
    alert_id: alert.id, ts, event_type: 'expired',
    price: null, ema: null, atr: null, distance_pct: null, distance_atr: null,
    message: 'TTL reached without qualification',
  });
}

function deltaPct(price, ema) {
  if (price == null || ema == null || ema === 0) return null;
  return ((price - ema) / ema) * 100;
}
function deltaAtr(price, ema, atrPct) {
  if (price == null || ema == null || ema === 0 || !atrPct) return null;
  return (Math.abs((price - ema) / ema) * 100) / atrPct;
}
function sideOf(price, ema) {
  if (price == null || ema == null) return null;
  if (price > ema) return 'above';
  if (price < ema) return 'below';
  return 'at';
}
function clampNum(v, lo, hi, dflt) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

module.exports = {
  createAlert, getById, list, getEvents, listEvaluable,
  setEnabled, softDelete, markRead, markAllRead, bulkDelete, unreadQualifiedCount,
  recordEvaluation, recordTrigger, recordExpiry,
  deltaPct, deltaAtr, sideOf, defaultApproachAtr, DEFAULT_TOUCH_ATR, DEFAULT_COOLDOWN_MIN,
  TFS, VALID_TRIGGERS,
};
