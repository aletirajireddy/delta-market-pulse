# Architecture Decisions — delta-market-pulse

> Living document. Every decision here was made for a reason found through
> live validation against real market data, not guessed. Read this before
> changing any of the patterns below — especially before "simplifying" one
> away, since most of them exist because the simpler version was tried
> first and broke on real data. Update this file in the same commit as any
> change that contradicts a decision recorded here.

---

## 1. Why this project exists at all

`tv-recommendation-fullstack` depended on Tampermonkey scripts scraping
live TradingView browser tabs (Streams A/B/C/D). That's fragile in a way
that has nothing to do with market data quality: tabs go dark for hours,
DOM/column layouts drift, virtualized screener grids miss off-screen rows,
backgrounded tabs get throttled by the browser. This project replaces that
entire scraping layer with direct public exchange REST APIs — no browser,
no tab, no scraping, nothing to "go stale" except a genuine network outage
(which now has retry/backoff, see §9).

**Consequence**: every "Stream X" concept from the old project either has
a direct API-sourced equivalent here, or was deliberately dropped because
it depended on something scraping-specific (see §7).

---

## 2. Data sources — why these three, and only these three

| Source | What it provides | Why this one |
|---|---|---|
| **Binance USDT-M Futures** | Price, 24h change/volume, candles for 112/185 coins | Deepest liquidity, cleanest public API, generous rate limits (confirmed empirically — see §8) |
| **Bybit linear perpetuals** | Same, for 46/185 coins | These 46 coins were specifically listed under `BYBIT:` in the user's original TradingView watchlist — using Binance for them was the exact bug found and fixed in §5 |
| **Delta Exchange India** | Funding rate, open interest, OI-spike detection, L2 orderbook | The user's actual trading account lives here; this is genuinely new data TradingView never had (no "matching" needed — Delta's own numbers are the ground truth) |

**26 MEXC-sourced + 1 BingX-sourced coin (27 total) have no client yet.**
They fall back to Binance with `sourceFallback: true` explicitly set in
`coinUniverse.json` — this is a known, flagged gap, not a silent
assumption. Building MEXC/BingX clients is the natural next extension (see
§11 for how).

**No TradingView dependency anywhere in this pipeline.** Every indicator is
computed locally from raw OHLCV pulled directly from the exchanges above.

---

## 3. Per-coin exchange pinning — the most important pattern in this codebase

**The bug this fixes**: XPL was being read from Binance ($122M volume,
falsely passed the discovery filter) when the user's original watchlist
specifically listed it as `BYBIT:XPLUSDT.P` (real Bybit volume: ~$52M,
correctly below the $100M threshold). The coin universe had silently
mapped every coin to Binance regardless of what exchange it was actually
meant to come from.

**The fix, and the rule going forward**: every coin in `coinUniverse.json`
has exactly one `sourceExchange`, taken from its original watchlist
prefix. That one exchange is used for **everything** about that coin:
- Discovery filter (change%, volume, volume-change%)
- Every timeframe of candles → EMA200, RSI, ATR, RVOL, ADX, cascade,
  mega-spot, smart levels, breakout, consolidation
- The "did this coin actually move" check that gates ghost/prune

**Never mixed mid-pipeline.** A coin is never evaluated against two
exchanges' data at different pipeline stages. All routing goes through one
dispatch point: `server/services/marketData.js`.

**Delta is the deliberate, single exception** — OI/funding/orderbook come
from Delta uniformly for every coin, regardless of `sourceExchange`,
because that's Delta's own derivatives data, not tied to where a coin's
spot/perp liquidity actually lives. This is a conscious asymmetry, not an
oversight.

**Latent bug this pattern also caught**: `filterEngine.js`'s volume-change
lookup and `momentumScanner.js`'s ticker lookup both had hardcoded
`source = 'binance'` in their SQL — meaning all 46 Bybit-pinned coins could
never appear in momentum-scan at all, and volume-change could silently
tie-break between a coin's real source-exchange row and its same-timestamp
Delta row. Both fixed the same day this pattern was introduced. **If you
ever see a raw SQL query against `coin_ticker_snapshot` or
`coin_indicator_snapshot` with a hardcoded `source` or exchange string
instead of `coin.sourceExchange`, that's this same bug class — fix it the
same way.**

---

## 4. Two-tier compute model — why we don't run deep indicators on all 185 coins

| Tier | Scope | Cost | What runs |
|---|---|---|---|
| **1** | All 185 coins, every cycle | ~2 ticker calls (one per exchange, covers everyone) + 185 klines calls for volume-change (concurrency-limited to 15) + 1 Delta call | Discovery filter only — change%, volume, volume-change% |
| **2** | Only "watched" coins (qualifying/active/ghosted — currently ~11) | ~10 API calls **per coin** | Everything else: EMA200 stack, RSI, ATR, RVOL, ADX, cascade, mega-spot, smart levels, breakout, consolidation, session metrics |

**Why**: running Tier 2's ~10 calls/coin against all 185 coins would be
~1,850 calls/cycle — over Binance's entire 2,400/min budget on its own,
before counting anything else. The discovery filter's job is to narrow 185
down to a small set *before* spending the expensive budget on it. This is
the same shape as the old project's Stream A (cheap, broad scan) → Stream
B (narrow watchlist) → richer per-coin data relationship, just re-derived
from first principles against API rate limits instead of browser-tab
constraints.

---

## 5. The discovery filter (3-threshold) and why volume-change is exchange-native, not self-referencing

**The three conditions** (mirrors the user's actual TradingView screener
config, confirmed via live screenshot):
1. `|24h change%| >= 2%`
2. `24h volume (USD) > $100M`
3. `24h volume change% >= 5%`

**Volume-change was originally self-referencing** (compared today's stored
snapshot to our own snapshot from ~24h ago) — this meant `qualifying_count`
stayed stuck at 0 for the system's entire first day, since the poller
hadn't been running for 24 real hours yet to have a comparison point. Fixed
by sourcing the 24h-ago baseline directly from the exchange's own
historical candles (sum of last 24 hourly candles vs. the 24 before that)
— no warmup needed, ever, even after a restart.

**Fallback + persistence added afterward**: if the exchange klines fetch
fails (outage outlasting retry/backoff), falls back to the cheap
self-referencing comparison instead of going blank. Every cycle's computed
value (and which method produced it) is persisted to
`coin_volchange_history` — previously computed fresh and discarded every
cycle, meaning there was no way to audit what the filter saw over time.

---

## 6. Watchlist lifecycle: graduation gate → ghost/prune → veto

**35-minute graduation gate**: a coin must pass the 3-threshold filter
*continuously* for 35 minutes before graduating from `qualifying` to
`active`. Any single drop-out resets the timer to zero — this is
specifically what prevents flickery appear/disappear noise from a coin
that only briefly crosses the threshold.

**Ghost/prune timing matches the old project exactly**: 12h settle window
(a graduated coin isn't judged for inactivity before this) + 36h grace
window (once flagged, this long to show real activity before removal) =
48h total from a coin's own clock start. Runtime-adjustable via
`GET/POST /api/ghosts/watchdog-settings`, not a code constant.

**Auto vs. manual mode** (`ghostAutoApprove`): auto removes a coin that
never showed activity by grace expiry (no memory kept, re-earns everything
from scratch if it reappears); manual recycles it instead (clock resets,
stays on the watchlist, never auto-removes).

**The veto**: a coin still passing the live 3-threshold filter can never
be ghosted or pruned, regardless of its staleness clock — still qualifying
is itself proof of relevance.

**Majors + whitelist** (BTC/ETH hardcoded, everything else via
`coin_whitelist` table + `/api/whitelist` CRUD) bypass the filter and every
gate entirely — always active.

---

## 7. What was deliberately NOT ported from the old project, and why

| Old concept | Verdict | Reasoning |
|---|---|---|
| **EMA Position Code** (3-digit XYZ) | Dropped as a primary signal, kept as a non-wired utility function | Lossy compression of data we already have better (per-TF distances, cascade order); boundary-fragile (small real-data differences flip the whole code); the old project's own trading notes already needed a second metric bolted on to make it usable. Live-tested: matched Stream A's version only 4/10 times. |
| **Stream C `direction`/`momentum` field** | Not ported | The old project's own audit found it 87% correlated with the *preceding* 5 minutes but only 47% (coin-flip) with the *following* 15 — retrospective, not predictive. Cascade + RSI + RVOL already cover this better. |
| **GenieScore per-coin composite** | Not ported | The old project's own maintainers removed this the same week this project started, for the identical reason independently arrived at here: "a blended verdict standing in for the user's own read" is the exact anti-pattern the mission reframe exists to prevent. |
| **Alpha Scatter, Alerts Analyzer, Smart Mood Chart, System Sync Diagnostics, Stream Feed Health** | Dropped | All either depend on the dead Stream C institutional-alert feed, or monitor the health of the old 4-browser-stream architecture, which doesn't exist here (one clean API poller, nothing to cross-monitor). |
| **Stream C's institutional "many alerts across many coins = market event" burst signal** | Replaced, not dropped | `breadthScanner.js` reproduces the same underlying idea (cross-sectional breadth) computed from `momentumScanner.js`'s SURGING/BUILDING classification instead of counted webhook alerts. |
| **Stochastic oscillator** | Explicitly skipped per user decision | Meaningfully redundant with RSI + cascade; revisit only if a specific gap is found later. |

**The general rule this reflects**: a market-wide **aggregate** (breadth,
mood score) is fine — it's a fact about the market, not a verdict about a
trade. A **per-coin composite** standing in for the user's own
price-action read is the pattern to always push back on, discussed
explicitly and by both this project's and the old project's own course
correction, independently.

---

## 8. Rate limits and 24/7 operation

Confirmed empirically (via `X-MBX-USED-WEIGHT-1M` response headers, not
docs, which are unreliable/JS-rendered):
- Binance klines (limit ≤500): weight 2. (limit ≤100): weight 1.
- Binance 24hr ticker, all symbols: weight 40.
- Binance IP limit: 2,400/min.
- Delta: 20,000 req / 5-min window — effectively unlimited for this use.

At current watchlist size (~11 coins), total usage is roughly
40 (Tier 1 ticker) + 185 (Tier 1 volume-change) + 110 (Tier 2, ~10/coin)
≈ 335 weight/min — **~14% of the 2,400 ceiling**, even before accounting
for Bybit's separate budget. Headroom is large enough that watchlist size
would need to reach ~140+ simultaneously-active coins before this becomes
a real constraint, which the discovery filter's whole purpose is to
prevent.

**Retry/backoff** (`httpRetry.js`) handles transient failures (network
errors, 5xx) and rate-limit responses (429/418, honoring `Retry-After`)
for every exchange call. **PM2** (`ecosystem.config.js`) provides
auto-restart — verified live by killing the process externally and
confirming it came back online within seconds.

---

## 9. Validation methodology — never trust a port, always diff against live data

Every indicator in this codebase was checked against a live TradingView
reading (via direct read-only queries against `tv-recommendation-
fullstack`'s `dashboard_v3.db`, never by editing that project) before being
trusted:

- Price, RSI, ATR, EMA200 (m5/h1/h4), session change%, base/neck levels,
  fib618, HTF daily/weekly/monthly OHLC: all matched within normal noise
  once **tightly time-aligned** (seconds, not minutes — several apparent
  mismatches early on turned out to be timing-alignment artifacts, not
  real bugs).
- **The one confirmed real defect found**: Stream C's `smart_levels.
  emas_200.m15` is a genuine source bug in the old project's Pine script
  (`smart-levels_indicator.js` line 117) — it requests the m15 EMA200 on
  the **Daily** (`"D"`) timeframe by copy-paste error, not 15-minute.
  Reproduced independently across 10+ coins, both historically and live.
  This project's own m15 computation is correct (validated against Stream
  D, the trusted layer, within <1% across 8 coins/all TFs) — this is a bug
  in the thing being replaced, not in this project.
- Mega-spot clustering: logic ported faithfully and structurally validated
  (position-code math checks out), but never caught a live *positive*
  cluster case from Stream C to confirm against — only agreement-on-absence
  so far. Still open.

**Rule for future work**: any new indicator ported from the old Pine
scripts should go through the same process — find the exact formula in the
source, port it, then diff against a live reading with tight timestamp
alignment before trusting it in a widget.

---

## 10. Widget backends built this session (data layer only — no frontend yet)

| Endpoint | Backs | Key design note |
|---|---|---|
| `/api/ema-candle-wall` | EMA200 Candle Wall | Body = h4→h1→m15 cascade, wick = m5→m1 counter-series, `expanded` flag = price broke structure with no real counter-move (ATR-filtered) |
| `/api/rsi-grid-wall` | RSI Grid Wall | Multi-TF cascade classification (BEAR/BULL_CASCADE, PARTIAL_*, pullback) |
| `/api/rsi-speedbreaker` | RSI Speedbreaker Distribution | Single-TF bucketing: oversold/rejection(48-52)/overbought — distinct from the multi-TF grid wall above |
| `/api/speed-breakers` | Speed Breakers level table | Compiles every known level (EMA200 stack, base/neck, fib, HTF OHLC incl. monthly, mega-spot) into one labeled, distance-sorted list; next-up/next-down = nearest above/below |
| `/api/distance-tracker` | Distance Tracker | Per-TF EMA200 distance%, sorted by proximity |
| `/api/breakouts?tf=` | (new, no old equivalent) | Configurable-TF cross-coin breakout/consolidation scan |
| `/api/momentum-scan` | Momentum pulse | SURGING/BUILDING tiers, full 185-coin universe (Tier 1 data only) |
| `/api/market-breadth` | 360° Pulse Radar replacement | Breadth-of-spikes vs. own rolling baseline; "Origin Dominance" (smart vs. tech alert split) has no equivalent — that was alert-*type* tagging, which doesn't exist without Stream C webhooks |
| `/api/smart-alerts/*` | Smart Alerts | EMA200 proximity alerts (approach/touch/cross), no external notification channel yet (in-app state + event history only) |

Mystery badges from the reference screenshots (small triangle+number,
flame+number icons) are **unconfirmed** — `megaSpotCount` was used as an
unvalidated placeholder in `rsi-speedbreaker`. Don't assume this is
correct without confirming what the original badge actually represented.

---

## 11. How to plug in a new data source later

This is the point of §3's exchange-pinning pattern — adding a new source
should never require touching the discovery filter, the indicator engine,
or any widget endpoint. Only these three places:

1. **Write a new exchange client** (`server/services/exchanges/
   newExchangeClient.js`), matching the existing shape: `get24hrTickers()`
   returning normalized `{symbol, ...}` rows, `getKlines(symbol, interval,
   limit, endTime)` returning `[time, open, high, low, close, volume, ...]`
   arrays (index 1-5 must be open/high/low/close/volume — everything
   downstream reads those positions, not named fields). Wrap the raw
   `fetch` call in `httpRetry.js`'s `fetchWithRetry` like the existing
   clients do.
2. **Register it in `marketData.js`**: add it to `fetchAllTickers()`'s
   `Promise.all`, add a branch in `getTickerForCoin()`/`getKlinesForCoin()`
   keyed by the new `sourceExchange` string.
3. **Tag the relevant coins in `coinUniverse.json`** with the new
   `sourceExchange` value (and `sourceSymbol` if it differs from `{base}
   USDT`).

Nothing else changes. `indicatorEngine.js`, `filterEngine.js`, every
widget endpoint — all already route through `marketData.js` and never
reference a specific exchange by name.

**For a genuinely new category of data** (not price/volume/candles, e.g.
on-chain flow or a sentiment index): add it as its own service module
(same pattern as `oiSpike.js`/`atrExpansion.js` — self-contained, own
rolling baseline if needed, wired into `poller.js`'s indicator pass or
main loop depending on whether it needs Tier 1 or Tier 2 treatment) rather
than threading it through `marketData.js`, which is specifically the
OHLCV/ticker abstraction.

---

## 12. Ports and process management

See [`PORTS.md`](../PORTS.md) — this project and `tv-recommendation-
fullstack` share one PM2 daemon on this machine; that file is the single
source of truth for every port and PM2 app name across both, and reserves
4173 (Vite's own default preview port) for this project's not-yet-built
frontend.
