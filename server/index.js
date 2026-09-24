require('dotenv').config();
const express = require('express');
const db = require('./db/database');
const poller = require('./poller');
const thresholds = require('./config/thresholds');

const app = express();
const PORT = process.env.PORT || 4000;

app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/watchlist', (req, res) => {
  const rows = db.prepare(`
    SELECT base, status, qualifying_since, graduated_at, last_active_at, ghosted_at
    FROM coin_lifecycle WHERE status IN ('qualifying', 'active', 'ghosted')
    ORDER BY status, graduated_at DESC
  `).all();
  res.json({ count: rows.length, coins: rows });
});

app.get('/api/pulse', (req, res) => {
  const hours = Number(req.query.hours) || 6;
  const since = Date.now() - hours * 60 * 60 * 1000;
  const rows = db.prepare('SELECT * FROM watchlist_pulse WHERE ts >= ? ORDER BY ts ASC').all(since);
  res.json(rows);
});

app.get('/api/coin/:base', (req, res) => {
  const base = req.params.base.toUpperCase();
  const lifecycle = db.prepare('SELECT * FROM coin_lifecycle WHERE base = ?').get(base);
  const snapshots = db.prepare(`
    SELECT * FROM coin_ticker_snapshot WHERE base = ?
    ORDER BY ts DESC LIMIT 20
  `).all(base);
  res.json({ base, lifecycle: lifecycle || null, recentSnapshots: snapshots });
});

app.listen(PORT, () => {
  console.log(`delta-market-pulse listening on :${PORT}`);
  poller.start(thresholds.pollIntervalMs);
});
