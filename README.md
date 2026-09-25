# delta-market-pulse

API-driven crypto price-action dashboard for a fixed 185-coin universe, built
on **public Binance + Bybit + Delta Exchange India endpoints only** — no
TradingView dependency, no API key required for any market data used here.

This is a separate project from `tv-recommendation-fullstack`. No code or
runtime is shared between the two, but they run under the same PM2 daemon on
the same machine — see [PORTS.md](PORTS.md) before touching any port, PM2
app name, or Tailscale route in either project.

**Read [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md)**
for the full reasoning behind every design choice — why these data sources,
why coins are pinned to one exchange each, why the two-tier compute model,
what was deliberately not ported from the old project and why, and how to
plug in a new data source later.

**Read [docs/NEXT_SESSION_HANDOFF.md](docs/NEXT_SESSION_HANDOFF.md)** for
current status and open items before picking up work here.

## Why

The old system depended on Tampermonkey scripts scraping TradingView tabs —
fragile (tabs going dark, DOM/column drift, virtualized-grid misses). This
project sources the same categories of signal (price/volume, EMA200 stack,
RSI, ATR, mega-spot clustering, smart levels, funding/OI) directly from
exchange APIs and computes every indicator locally, so nothing depends on a
browser tab staying open. Every indicator has been validated live against
the old project's TradingView data before being trusted — see §9 of the
architecture doc.

## Quick architecture summary

- **Coin universe** (`server/data/coinUniverse.json`) — 185 tickers, each
  pinned to the exchange (Binance or Bybit) its original watchlist entry
  actually specified — never assumed. Delta stays uniform for OI/funding
  across every coin regardless of pinning. See §3 of the architecture doc.
- **Two-tier compute**: all 185 coins get cheap ticker-only data every
  cycle; only the small "watched" set (post-discovery-filter) gets the full
  EMA/RSI/ATR/cascade/smart-levels treatment. See §4.
- **Discovery filter** — 3 thresholds (±2% change, >$100M volume, ≥5%
  volume-change), volume-change sourced live from exchange history (no
  warmup needed), with a cheap in-house fallback if the exchange call fails.
- **Graduation gate** (35min continuous-qualifying) → **ghost/prune**
  (12h settle / 36h grace, auto/manual toggle, veto for still-qualifying
  coins) → **majors + whitelist** bypass everything.

## Config

Most thresholds/windows live in `server/config/thresholds.js`; ghost/prune
timing is runtime-adjustable via `/api/ghosts/watchdog-settings` (DB-backed,
no redeploy needed).

## Running

```bash
npm install
cp .env.example .env
pm2 start ecosystem.config.js
```

## Key API endpoints

- `GET /health`
- `GET /api/watchlist` — current qualifying/active/ghosted coins
- `GET /api/pulse?hours=6` — qualifying-count vs active-count over time
- `GET /api/coin/:base` — lifecycle + full indicator snapshot for one coin
- `GET /api/ema-candle-wall`, `/api/rsi-grid-wall`, `/api/rsi-speedbreaker`,
  `/api/speed-breakers`, `/api/distance-tracker` — widget data
- `GET /api/breakouts?tf=m15` — configurable-TF breakout/consolidation scan
- `GET /api/momentum-scan`, `/api/market-breadth` — cross-coin momentum/
  breadth (no frontend consumes these yet)
- `GET/POST /api/smart-alerts` — EMA200 proximity alerts
- `GET/POST /api/whitelist/:base`, `/api/ghosts/watchdog-settings`

## Status

Data layer is comprehensive and validated live: discovery, graduation,
ghost/prune, full indicator suite, and every widget backend above are built
and running 24/7 under PM2. **No frontend exists yet** — see the handoff
doc for priorities.
