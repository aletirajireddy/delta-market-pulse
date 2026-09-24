# delta-market-pulse

API-driven crypto price-action dashboard for a fixed 185-coin universe, built
on **public Binance + Delta Exchange India endpoints only** — no TradingView
dependency, no API key required for any market data used here.

This is a separate project from `tv-recommendation-fullstack`. No code or
runtime is shared between the two.

## Why

The old system depended on Tampermonkey scripts scraping TradingView tabs —
fragile (tabs going dark, DOM/column drift, virtualized-grid misses). This
project sources the same categories of signal (price/volume, EMA200 stack,
RSI, ATR, mega-spot clustering, smart levels, funding/OI) directly from
exchange APIs and computes every indicator locally, so nothing depends on a
browser tab staying open.

## Architecture

- **Coin universe** (`server/data/coinUniverse.json`) — 185 tickers, each
  mapped to a Binance USDT-M perpetual symbol and a Delta India perpetual
  symbol. All 185 confirmed listed on both exchanges.
- **Discovery filter** (`server/services/watchlist/filterEngine.js`) — a
  coin "qualifies" when `|24h change| >= 2%`, `24h $ volume > $100M`, and
  `24h volume change >= 5%` (same thresholds as the user's TradingView
  screener). Computed from Binance 24hr ticker data plus our own stored
  volume history (for the volume-change comparison).
- **Graduation gate** (`server/services/watchlist/graduationGate.js`) — a
  qualifying coin must pass the filter continuously for 35 minutes before it
  graduates onto the active watchlist. Any drop-out resets the timer — this
  is what prevents flickery appear/disappear noise.
- **Ghost/prune + veto** (`server/services/watchlist/ghostPrune.js`) — a
  graduated coin that goes quiet (no genuine price movement) for the settle
  window is queued as "ghosted"; if it stays quiet through the grace window
  it's pruned. A coin still passing the live filter can **never** be
  ghosted/pruned, regardless of its quiet clock (the veto).
- **Majors + whitelist** — BTC and ETH bypass the filter/gate entirely,
  always active.
- **Indicators** (`server/services/indicators/`) — EMA200/RSI14/ATR/RVOL per
  timeframe computed locally from raw candles (`technical.js`), plus a
  faithful port of the user's Pine Script mega-spot clustering and EMA
  Position Code logic (`megaSpot.js`).
- **OI spikes** (`server/services/oiSpike.js`) — same rolling-baseline
  spike-detection shape as volume-spike detection, applied to Delta's open
  interest data.

## Config

All thresholds/windows live in `server/config/thresholds.js` — one place to
look, one place to change.

## Running

```bash
npm install
cp .env.example .env
npm start
```

- `GET /health`
- `GET /api/watchlist` — current qualifying/active/ghosted coins
- `GET /api/pulse?hours=6` — qualifying-count vs active-count over time
- `GET /api/coin/:base` — lifecycle + recent raw snapshots for one coin

## Status

Data pipeline (discovery, graduation, ghost/prune, base indicators) is v1.
Mega-spot/smart-levels wiring into the poll cycle and the frontend are not
built yet.
