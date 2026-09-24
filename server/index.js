require('dotenv').config();
const express = require('express');
const db = require('./db/database');
const poller = require('./poller');
const thresholds = require('./config/thresholds');
const whitelist = require('./services/watchlist/whitelist');
const rsiGridWall = require('./services/indicators/rsiGridWall');
const momentumScanner = require('./services/momentumScanner');
const smartAlertsRouter = require('./routes/smartAlerts');
const { buildCandle } = require('./services/indicators/emaCandleWall');
const breadthScanner = require('./services/breadthScanner');

const app = express();
app.use(express.json());
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
  const indicators = db.prepare(`
    SELECT * FROM coin_indicator_snapshot WHERE base = ?
    ORDER BY ts DESC LIMIT 1
  `).get(base);
  res.json({
    base,
    lifecycle: lifecycle || null,
    recentSnapshots: snapshots,
    indicators: indicators ? {
      ts: indicators.ts,
      ema200: JSON.parse(indicators.ema200),
      rsi14: JSON.parse(indicators.rsi14),
      atrPct: JSON.parse(indicators.atrPct),
      rvol: JSON.parse(indicators.rvol),
      cascade: indicators.cascade,
      megaSpots: JSON.parse(indicators.megaSpots),
      smartLevels: JSON.parse(indicators.smartLevels),
      sessionChangePct: indicators.sessionChangePct,
      sessionVolumeUsd: indicators.sessionVolumeUsd,
    } : null,
  });
});

app.get('/api/rsi-grid-wall', (req, res) => {
  const config = {
    seriesTfs: (req.query.series_tfs || 'h1,m30').split(',').map((s) => s.trim()),
    tempTf: (req.query.temp_tf || 'm15').trim(),
    oversold: parseFloat(req.query.oversold ?? 30),
    overbought: parseFloat(req.query.overbought ?? 70),
    pullbackZone: parseFloat(req.query.pullback_zone ?? 5),
  };

  const bases = db.prepare(`SELECT DISTINCT base FROM coin_indicator_snapshot`).all().map((r) => r.base);
  const coins = [];
  for (const base of bases) {
    const rows = db.prepare(`
      SELECT ts, rsi14 FROM coin_indicator_snapshot WHERE base = ? ORDER BY ts DESC LIMIT 2
    `).all(base);
    if (!rows.length) continue;
    const rsi = JSON.parse(rows[0].rsi14);
    const prevRsi = rows[1] ? JSON.parse(rows[1].rsi14) : null;
    const result = rsiGridWall.classify(rsi, prevRsi, config);
    coins.push({ base, ts: rows[0].ts, rsi, ...result });
  }

  res.json({ coins: rsiGridWall.sortCoins(coins), config });
});

app.get('/api/distance-tracker', (req, res) => {
  const bases = db.prepare(`SELECT DISTINCT base FROM coin_indicator_snapshot`).all().map((r) => r.base);
  const coins = [];
  for (const base of bases) {
    const row = db.prepare(`SELECT ts, ema200 FROM coin_indicator_snapshot WHERE base = ? ORDER BY ts DESC LIMIT 1`).get(base);
    const priceRow = db.prepare(`SELECT price FROM coin_ticker_snapshot WHERE base = ? AND source = 'binance' ORDER BY ts DESC LIMIT 1`).get(base);
    if (!row || !priceRow) continue;
    const ema200 = JSON.parse(row.ema200);
    const price = priceRow.price;
    const dist = {};
    for (const tf of Object.keys(ema200)) {
      dist[tf] = ema200[tf] != null ? ((price - ema200[tf]) / ema200[tf]) * 100 : null;
    }
    const nearestTf = Object.entries(dist)
      .filter(([, v]) => v != null)
      .sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
    coins.push({ base, ts: row.ts, price, ema200, dist, nearestTf: nearestTf ? nearestTf[0] : null, nearestDist: nearestTf ? nearestTf[1] : null });
  }
  coins.sort((a, b) => Math.abs(a.nearestDist ?? 999) - Math.abs(b.nearestDist ?? 999));
  res.json({ coins });
});

app.get('/api/ema-candle-wall', (req, res) => {
  const bases = db.prepare(`SELECT DISTINCT base FROM coin_indicator_snapshot`).all().map((r) => r.base);
  const coins = [];
  for (const base of bases) {
    const row = db.prepare(`SELECT * FROM coin_indicator_snapshot WHERE base = ? ORDER BY ts DESC LIMIT 1`).get(base);
    if (!row) continue;
    const snap = {
      base,
      price: row.price,
      ema200: JSON.parse(row.ema200),
      atr14: row.atr14 ? JSON.parse(row.atr14) : {},
      cascade: row.cascade,
      counterCascade: row.counterCascade,
      sessionChangePct: row.sessionChangePct,
    };
    coins.push(buildCandle(snap));
  }
  const order = { bull: 0, bear: 1, neutral: 2 };
  coins.sort((a, b) => (order[a.cascade] ?? 3) - (order[b.cascade] ?? 3));
  res.json({ coins, count: coins.length });
});

app.get('/api/momentum-scan', (req, res) => {
  res.json({ coins: momentumScanner.scan() });
});

app.get('/api/market-breadth', (req, res) => {
  const hours = Number(req.query.hours) || 6;
  const since = Date.now() - hours * 60 * 60 * 1000;
  const history = db.prepare('SELECT * FROM breadth_snapshot WHERE ts >= ? ORDER BY ts ASC').all(since);
  res.json({ history });
});

app.use('/api/smart-alerts', smartAlertsRouter);

app.get('/api/whitelist', (req, res) => {
  res.json({ majors: thresholds.permanentMajors, whitelist: whitelist.list() });
});

app.post('/api/whitelist/:base', (req, res) => {
  whitelist.add(req.params.base);
  res.json({ ok: true, whitelist: whitelist.list() });
});

app.delete('/api/whitelist/:base', (req, res) => {
  whitelist.removeCoin(req.params.base);
  res.json({ ok: true, whitelist: whitelist.list() });
});

app.listen(PORT, () => {
  console.log(`delta-market-pulse listening on :${PORT}`);
  poller.start(thresholds.pollIntervalMs);
});
