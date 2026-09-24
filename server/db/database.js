const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.resolve(__dirname, '..', '..', 'market_pulse.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS coin_ticker_snapshot (
  base TEXT NOT NULL,
  ts INTEGER NOT NULL,
  price REAL,
  change_pct_24h REAL,
  volume_usd_24h REAL,
  oi_usd REAL,
  funding_rate REAL,
  source TEXT NOT NULL,
  PRIMARY KEY (base, ts, source)
);
CREATE INDEX IF NOT EXISTS idx_snapshot_base_ts ON coin_ticker_snapshot(base, ts DESC);

CREATE TABLE IF NOT EXISTS coin_lifecycle (
  base TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',       -- idle | qualifying | active | ghosted
  qualifying_since INTEGER,                  -- ms epoch, reset on any drop-out
  graduated_at INTEGER,
  last_active_at INTEGER,                    -- last time genuine movement was seen
  ghosted_at INTEGER,                        -- when queued for removal review
  removed_at INTEGER
);

CREATE TABLE IF NOT EXISTS watchlist_pulse (
  ts INTEGER PRIMARY KEY,
  qualifying_count INTEGER NOT NULL,
  active_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oi_baseline (
  base TEXT PRIMARY KEY,
  samples TEXT NOT NULL   -- JSON array of recent OI USD readings
);

CREATE TABLE IF NOT EXISTS coin_indicator_snapshot (
  base TEXT NOT NULL,
  ts INTEGER NOT NULL,
  price REAL,
  ema200 TEXT NOT NULL,      -- JSON {m1,m5,m15,m30,h1,h4}
  rsi14 TEXT NOT NULL,       -- JSON {m1,m5,m15,m30,h1,h4}
  atrPct TEXT NOT NULL,      -- JSON {m1,m5,m15,m30,h1,h4}
  atr14 TEXT,                -- JSON {m1,m5,m15,m30,h1,h4} raw absolute ATR
  rvol TEXT NOT NULL,        -- JSON {m1,m5,m15,m30,h1,h4}
  cascade TEXT NOT NULL,     -- 'bull' | 'bear' | 'neutral' (h4->h1->m15 body)
  counterCascade TEXT,       -- 'bull' | 'bear' | 'neutral' (m5->m1 wick)
  megaSpots TEXT NOT NULL,   -- JSON array of {price,count,tfs}
  smartLevels TEXT NOT NULL, -- JSON {daily:{...}, hourly:{...}, fib:{...}}
  sessionChangePct REAL,
  sessionVolumeUsd REAL,
  PRIMARY KEY (base, ts)
);
CREATE INDEX IF NOT EXISTS idx_indicator_base_ts ON coin_indicator_snapshot(base, ts DESC);

CREATE TABLE IF NOT EXISTS coin_whitelist (
  base TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_alerts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  base TEXT NOT NULL,
  timeframe TEXT NOT NULL,       -- m5 | m15 | m30 | h1 | h4
  triggers_json TEXT NOT NULL,   -- ['approach','touch','cross']
  params_json TEXT NOT NULL,     -- {approach_atr, touch_atr, recurring, cooldown_min, expiry_hours, note}
  state TEXT NOT NULL DEFAULT 'active', -- active | qualified | expired | disabled
  expires_at INTEGER,
  last_evaluated_at INTEGER,
  last_price REAL,
  last_ema REAL,
  last_atr REAL,
  last_side TEXT,                -- above | below | at
  qualified_count INTEGER NOT NULL DEFAULT 0,
  last_qualified_at INTEGER,
  acknowledged_at INTEGER,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alerts_base ON smart_alerts(base) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS smart_alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- created | approach | touch | cross | expired | enabled | disabled
  price REAL, ema REAL, atr REAL,
  distance_pct REAL, distance_atr REAL,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_events_alert ON smart_alert_events(alert_id, id DESC);

CREATE TABLE IF NOT EXISTS breadth_snapshot (
  ts INTEGER PRIMARY KEY,
  surging_count INTEGER NOT NULL,
  building_count INTEGER NOT NULL,
  oi_spike_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS atr_baseline (
  base TEXT NOT NULL,
  tf TEXT NOT NULL,
  samples TEXT NOT NULL,
  PRIMARY KEY (base, tf)
);
`);

// Safe additive migration — CREATE TABLE IF NOT EXISTS doesn't alter an
// already-existing table, so new columns added after the table's first
// creation need this. Same pattern as the old project's _safeAddColumn.
function safeAddColumn(table, columnDef, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  }
}
safeAddColumn('coin_indicator_snapshot', 'price REAL', 'price');
safeAddColumn('coin_indicator_snapshot', 'atr14 TEXT', 'atr14');
safeAddColumn('coin_indicator_snapshot', 'counterCascade TEXT', 'counterCascade');
safeAddColumn('coin_indicator_snapshot', 'adx TEXT', 'adx');

module.exports = db;
