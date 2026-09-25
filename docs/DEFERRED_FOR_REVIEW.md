# Deferred for Review

> A running list of things noticed while porting/building against the old
> project that look like they might not apply here, or where the right call
> isn't obvious without the user's input. Not a TODO list and not a scope
> document — items here are explicitly **parked, not decided**. Add to this
> whenever something like this comes up rather than silently dropping it or
> silently keeping it. Review together when there's time; nothing here
> blocks other work.

## Header — two old-project icon toggles with no clear new-project equivalent (2026-09-25)

Investigated at the user's request (didn't recall what these did). Both
came from `GlobalHeader.jsx`.

- **Eye/EyeOff — "Active Coin Mask."** Filtered every per-coin widget to
  just the tickers present in the *currently loaded scan* (`activeScan`
  from the timeline/playback system). No scope here — this depends on the
  per-scan-snapshot concept that only exists alongside the Playback HUD,
  which is already explicitly cut (see `ARCHITECTURE_DECISIONS.md` §7).
  Not a new decision, just the same one applied here.
- **DollarSign/Hash — "Volume Display Mode" ($ vs. coin-unit count).**
  Guards against a real bug the old project found and fixed
  (`client/src/utils/volumeMode.js`, 2026-09-23): some old-project volume
  fields were genuinely coin-unit-denominated while displayed as if they
  were dollars. Checked this project's own data before parking this: every
  volume field here (`coin_ticker_snapshot.volume_usd_24h`,
  `sessionVolumeUsd`) is already uniformly $-denominated — there is no
  parallel coin-unit volume value anywhere in this project's schema to
  toggle to. So the toggle's premise doesn't currently apply, not because
  the underlying concern is unimportant, but because the ambiguity it
  guards against doesn't exist here by construction. **Parked, not
  dismissed** — worth a second look if a future data source (e.g. MEXC/
  BingX before their real clients were built, or a future new exchange)
  ever reintroduces a coin-unit-only volume field into this project.

## Frontend v1 build — pieces intentionally scoped down or not adopted (2026-09-25)

While scaffolding `client/` (shell + first 4 widgets):

- **`ThemeBuilder.jsx`'s full custom-palette editor** (per-CSS-variable
  color pickers, save/delete named themes) was not ported — the new
  `SettingsPanel` only has a light/dark mode toggle for v1. The old app's
  `useThemeStore.js` mechanism (CSS vars + `persist`) was kept, just
  without the custom-theme authoring UI on top of it. Revisit if a real
  need for user-authored palettes shows up.
- **`react-router-dom` and `socket.io-client`** are in the old app's
  `package.json` but not used by anything ported this session (no routes
  yet — single-page shell; no websocket push in this project's backend,
  it's poll-based). Not adopted in `client/package.json`. Add both back
  if/when a coin-detail route or a push-based data channel is built.
- **`MarketHeartbeatIndicator`, `SystemTimeCard`, `WatchlistSyncAlarm`**
  (other pieces of the old app's `HeaderStatsDeck`) were not ported —
  only the Market Gauge and Market Breadth pieces the user explicitly
  asked to keep. Heartbeat/SystemTimeCard were tied to the Playback HUD's
  timeline concept (already cut); revisit only if a live-mode equivalent
  becomes genuinely useful.

## Future idea — single-coin "eagle eye" detail view (raised 2026-09-25)

User's own framing: a coin-detail page/toolbox that pulls everything this
project already knows about one coin (RSI cascade, EMA/smart levels,
momentum, breakout/consolidation state, alerts, recent price-action) into
one place, so the transition/story of that coin is visible at a glance
rather than scattered across separate widgets. Explicitly **not scoped
now** — "leave this for now," per the user. Maps onto the "Coin detail
page" item already listed as out-of-scope in the frontend v1 plan; when
picked up, `GET /api/coin/:base` already returns most of the needed
payload in one call (lifecycle, recent snapshots, full indicator set).
