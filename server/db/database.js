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
  ema200 TEXT NOT NULL,      -- JSON {m5,m15,h1,h4}
  rsi14 TEXT NOT NULL,       -- JSON {m5,m15,h1,h4}
  atrPct TEXT NOT NULL,      -- JSON {m5,m15,h1,h4}
  rvol TEXT NOT NULL,        -- JSON {m5,m15,h1,h4}
  cascade TEXT NOT NULL,     -- 'bull' | 'bear' | 'neutral'
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
`);

module.exports = db;
