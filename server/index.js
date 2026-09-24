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
const { buildLevelCatalog } = require('./services/levelCatalog');
const ghostSettings = require('./services/watchlist/ghostSettings');

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
      adx: indicators.adx ? JSON.parse(indicators.adx) : null,
      cascade: indicators.cascade,
      counterCascade: indicators.counterCascade,
      consolidation: indicators.consolidation ? JSON.parse(indicators.consolidation) : null,
      activeBreakout: indicators.activeBreakout ? JSON.parse(indicators.activeBreakout) : null,
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

app.get('/api/speed-breakers', (req, res) => {
  const bases = db.prepare(`SELECT DISTINCT base FROM coin_indicator_snapshot`).all().map((r) => r.base);
  const coins = [];
  for (const base of bases) {
    const row = db.prepare(`SELECT * FROM coin_indicator_snapshot WHERE base = ? ORDER BY ts DESC LIMIT 1`).get(base);
    if (!row) continue;
    const price = row.price;
    const ema200 = JSON.parse(row.ema200);
    const smartLevels = JSON.parse(row.smartLevels);
    const megaSpots = JSON.parse(row.megaSpots);
    const { levels, nextUp, nextDown } = buildLevelCatalog(price, ema200, smartLevels, megaSpots);

    const tickerRow = db.prepare(`SELECT * FROM coin_ticker_snapshot WHERE base = ? AND source = 'binance' ORDER BY ts DESC LIMIT 1`).get(base);

    coins.push({
      base,
      price,
      momPct: row.sessionChangePct,
      volumeUsd: tickerRow?.volume_usd_24h ?? null,
      dayChangePct: tickerRow?.change_pct_24h ?? null,
      nextUp,
      nextDown,
      levels,
      ts: row.ts,
    });
  }
  res.json({ coins });
});

app.get('/api/rsi-speedbreaker', (req, res) => {
  const tf = (req.query.tf || 'm15').trim();
  const oversold = parseFloat(req.query.oversold ?? 30);
  const overbought = parseFloat(req.query.overbought ?? 70);
  const rejectionLow = parseFloat(req.query.rejection_low ?? 48);
  const rejectionHigh = parseFloat(req.query.rejection_high ?? 52);

  const bases = db.prepare(`SELECT DISTINCT base FROM coin_indicator_snapshot`).all().map((r) => r.base);
  const buckets = { oversold: [], rejection: [], overbought: [] };
  for (const base of bases) {
    const row = db.prepare(`SELECT ts, rsi14, price, megaSpots FROM coin_indicator_snapshot WHERE base = ? ORDER BY ts DESC LIMIT 1`).get(base);
    if (!row) continue;
    const rsi14 = JSON.parse(row.rsi14);
    const rsi = rsi14[tf];
    if (rsi == null) continue;
    const megaSpots = JSON.parse(row.megaSpots);
    const entry = { base, price: row.price, rsi, ts: row.ts, megaSpotCount: megaSpots.length };
    if (rsi < oversold) buckets.oversold.push(entry);
    else if (rsi > overbought) buckets.overbought.push(entry);
    else if (rsi >= rejectionLow && rsi <= rejectionHigh) buckets.rejection.push(entry);
  }
  buckets.oversold.sort((a, b) => a.rsi - b.rsi);
  buckets.overbought.sort((a, b) => b.rsi - a.rsi);
  res.json({ tf, buckets, counts: { oversold: buckets.oversold.length, rejection: buckets.rejection.length, overbought: buckets.overbought.length } });
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

app.get('/api/ghosts/watchdog-settings', (req, res) => {
  const s = ghostSettings.getSettings();
  res.json({ settleHours: s.settleMs / 3600000, graceHours: s.graceMs / 3600000, autoApprove: s.autoApprove });
});

app.post('/api/ghosts/watchdog-settings', (req, res) => {
  const s = ghostSettings.updateSettings(req.body || {});
  res.json({ settleHours: s.settleMs / 3600000, graceHours: s.graceMs / 3600000, autoApprove: s.autoApprove });
});

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

const server = app.listen(PORT, () => {
  console.log(`delta-market-pulse listening on :${PORT}`);
  poller.start(thresholds.pollIntervalMs);
});

// Fail loudly instead of a silent/confusing crash — port collisions across
// this project and tv-recommendation-fullstack are a known risk on this
// machine (both run under the same PM2 daemon). See PORTS.md before
// changing PORT or killing anything on this port.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Check PORTS.md for what's supposed to own this port before killing anything — do not assume it's safe to just pick a different port.\n`);
  }
  throw err;
});
