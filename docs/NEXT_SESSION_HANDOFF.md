# Next Session Handoff — delta-market-pulse

> Read `docs/ARCHITECTURE_DECISIONS.md` first — it has the full reasoning
> behind every pattern below. This doc is just "where things stand and what
> to do next," not the why.

## What this project is

API-driven replacement for `tv-recommendation-fullstack`'s TradingView-
scraping pipeline. Public Binance + Bybit + Delta Exchange India REST APIs
only — no TradingView dependency, no API key needed for any data used.
Fully separate repo, folder, and runtime from the old project; they only
share a PORTS.md registry and one PM2 daemon on this machine.

Repo: https://github.com/aletirajireddy/delta-market-pulse

## Current live state (as of this handoff)

- Running under PM2 (`delta-market-pulse`, port 4000), auto-restart
  verified working, saved to survive reboots.
- Watchlist: 11 coins — BTC/ETH (majors) + SOL (whitelist) active;
  AKE/ENA/LINK/LTC/ONDO/SAGA/XAI/XLM in the 35-min graduation timer.
  **This list changes constantly with the market** — don't treat these
  specific tickers as meaningful by the time you're reading this.
- Data pipeline validated live against `tv-recommendation-fullstack`'s DB
  multiple times this session: price/RSI/ATR/EMA200/session-change/smart-
  levels/breakout/consolidation all confirmed matching. Discovery filter
  matched the live TradingView screener count and exact ticker list twice.
- No frontend exists yet — everything is API-only.

## What's done (see ARCHITECTURE_DECISIONS.md §§ for full reasoning)

Data layer: coin universe (185 coins, each pinned to its real source
exchange), discovery filter (3-threshold, exchange-native volume-change
with fallback), graduation gate (35min), ghost/prune (12h/36h/48h, auto/
manual toggle, veto), whitelist, breadth scanner, OI-spike, ATR-expansion,
retry/backoff, PM2.

Indicators (Tier 2, watched coins only): EMA200 (all TFs), RSI, ATR, RVOL,
ADX, cascade + counter-cascade, mega-spot clustering, smart levels (base/
neck/fib/HTF daily/weekly/monthly), consolidation composite, breakout
detection (BB+volume+ATR confirmed), session metrics.

Widget backends (APIs only, no UI): EMA Candle Wall, RSI Grid Wall, RSI
Speedbreaker Distribution, Speed Breakers level table, Distance Tracker,
configurable-TF breakout scanner, Momentum Scan, Market Breadth, Smart
Alerts (EMA200 proximity, no external notification channel).

## Open items, in rough priority order

1. **Frontend hasn't started.** This is the biggest gap — a lot of
   validated backend surface exists with nothing rendering it. Port 4173
   is reserved (see PORTS.md). Stack decision already made: React/Vite,
   matching the old project's familiarity, but genuinely fresh code.
2. **Mega-spot positive-case validation still open** — every live check
   this session happened to catch `mega_spot: null` on both sides
   (agreement on absence, a weak test). Never confirmed the clustering math
   against a real positive cluster from Stream C. Catch one and diff it.
3. **Market Gauge Score / "Genie Engine"** — designed (§7 of
   ARCHITECTURE_DECISIONS.md: aggregate-only, cascade-based net bull/bear%,
   no new composite math) but never built. Get explicit sign-off on the
   design before building, given the track record of this exact idea going
   wrong twice in the old project.
4. **Market Structure bucketing + Momentum Pulse (richer)** — both
   designed, straightforward ports once started (see conversation history
   around "market structure bucketing" and "momentum pulse" for exact
   specs — not yet written into ARCHITECTURE_DECISIONS.md, do that if
   picking this up).
5. **ADX built; Stochastic explicitly skipped** per user decision — don't
   re-litigate unless a specific gap shows up.
6. **MEXC + BingX exchange clients** — 27 coins (26 MEXC + 1 BingX)
   currently fall back to Binance with `sourceFallback: true` flagged.
   Same pattern as the Bybit client (§11 of ARCHITECTURE_DECISIONS.md) if
   picked up.
7. **Mystery UI badges** (triangle+number, flame+number from the reference
   screenshots) — still unconfirmed what they represent. Ask before
   building a real version of whatever currently uses `megaSpotCount` as
   an unvalidated placeholder.
8. **Tailscale/remote exposure** — decided early to do this "from day one,"
   never executed. Routing collision risk with the old project's Funnel
   documented in PORTS.md, not yet resolved.
9. **CRCLX** — the one coin (of 185) with no working perpetual futures
   data on Binance or Bybit. Known, narrow, not worth chasing further
   unless it turns out to matter.

## Ground rules for whoever picks this up

- **Never edit `tv-recommendation-fullstack`'s files.** Read-only queries
  against its `dashboard_v3.db` for validation are fine and were done
  extensively; writing to it or its code was never done and shouldn't be.
- **Validate before trusting.** Every indicator in this codebase was diffed
  against a live TradingView reading before being trusted — see §9 of
  ARCHITECTURE_DECISIONS.md for the method (tight timestamp alignment
  matters — several apparent bugs this session turned out to be timing
  artifacts, not real ones).
- **Check PORTS.md before claiming any port or PM2 app name.**
- **The exchange-pinning pattern (§3) is load-bearing.** If you ever see a
  hardcoded `source = 'binance'`/`'bybit'` string instead of
  `coin.sourceExchange` in a new query, that's the exact bug class found
  and fixed multiple times this session — fix it the same way.
