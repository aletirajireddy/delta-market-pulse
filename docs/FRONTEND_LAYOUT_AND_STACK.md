# Frontend Layout, Mobile Behavior & UI Stack

> **Read this alongside `FRONTEND_TIME_CONVENTIONS.md` before writing the
> first line of frontend code.** This doc has two parts: (1) the exact old-
> project mobile/layout mechanics to replicate — checked against the real
> code, not remembered from a description — and (2) the UI stack decision
> for this project, given as a recommendation with the real tradeoffs
> stated, not a blind adoption of a pasted boilerplate.

## Part 1 — Old project's exact layout mechanics (replicate these)

Checked directly: `App.module.css`, `App.jsx`, `Sidebar.jsx`,
`GlobalHeader.jsx`, `MobileFloatingBar.jsx`, `ScrollToTopBottom.jsx`.

### App shell

```css
.appContainer { display: flex; flex-direction: column; height: 100dvh; }
```

**Use `100dvh`, not `100vh`**, deliberately — the old project's own comment
explains why: mobile Safari/Chrome measure `100vh` against the viewport
with the address bar hidden, so as the address bar shows/hides during
scroll, fixed/sticky elements jump or get clipped. `100dvh` tracks the
*actual* current viewport. Keep `100vh` only as a fallback for browsers
without `dvh` support.

### Header — sticky, not truly fixed, with blur

```css
.topBar {
  height: var(--header-height);
  position: sticky;
  top: 0;
  z-index: 2000;
  backdrop-filter: blur(8px);
}
```

`position: sticky` inside the flex-column app shell, not `position: fixed`
— it scrolls out of a normal document flow position but re-pins to the top
once you scroll past it, which is the "floating fixed header" behavior
being asked for. Same on desktop and mobile — no separate mobile-only
header component, just responsive content inside the same bar. The
`backdrop-filter: blur(8px)` glass effect is part of the look, not
incidental — keep it.

**Explicitly excluded from this header (decided 2026-09-25): the old
project's Playback HUD.** `GlobalHeader.jsx` there carries a full timeline-
scrubbing system — `Play`/`Pause`/`SkipBack`/`SkipForward` controls, a
`timeline`/`currentIndex` store, and a LIVE-vs-REPLAY status pill. None of
that is part of this project's header. This project's frontend is
**live-only, v1** — no timeline state in the store, no scrubber, no REPLAY
mode anywhere. This isn't an oversight; a separate backtesting/playback
frontend may get built later as its own app, and this scope is deliberately
kept out of `delta-market-pulse`'s UI so it doesn't grow timeline state it
would need to unwind later. See `ARCHITECTURE_DECISIONS.md` §7 for the
full reasoning.

### Sidebar — desktop collapse vs. mobile drawer, exact mechanics

Desktop (`>1024px` and not touch): instant width collapse via a
`PanelLeftClose`/`PanelLeft` (lucide-react) toggle button — no animation,
labels hidden via `display:none` when collapsed (not `visibility` or
`opacity`, so no layout ghost space).

Mobile (`≤1024px` OR `pointer: coarse` — note it's an OR, so a touch
laptop with a wide screen still gets mobile behavior):
- Sidebar becomes `position: fixed`, full-height, slides in from the left.
- Hamburger (`Menu` icon) in the header toggles a single `mobileMenuOpen`
  boolean in the global store.
- A backdrop overlay renders behind it, click-to-close.
- **Body scroll is locked** while open (`document.body.style.overflow =
  'hidden'`, restored on close) — this is a `useEffect` keyed on
  `mobileMenuOpen`, not a CSS-only trick.
- **ESC key closes it** — a `keydown` listener added/removed in the same
  effect.
- **Auto-closes on nav-item click** — selecting a menu item scrolls to the
  target section AND calls `setMobileMenuOpen(false)` in the same handler.

Each menu item does a `scrollIntoView({ behavior: 'smooth', block:
'start' })` against a `section-${id}` DOM id, with lazy-loaded widgets
handled via an awaited prefetch + two-animation-frame wait before retrying
the lookup (real bug found and fixed in the old project 2026-09-18 — worth
keeping the same retry logic rather than a naive single lookup).

### Mobile floating action bubble (`MobileFloatingBar`)

A separate, small floating-bubble pattern (bottom-corner FAB), independent
of the sidebar drawer — expands upward into a small panel showing stream
health / a live-status badge / notification bell / a settings shortcut.
This is a genuinely different, secondary nav surface from the main
hamburger drawer — for this project, repurpose the same *mechanism*
(expandable bottom-corner bubble) for whatever the equivalent quick-status
info is here (API/exchange connectivity health, watchlist count, alerts).
**Drop the REPLAY half of the old badge** (it's the same excluded Playback
HUD concept above) — keep only a live/connected indicator, no live-vs-
replay toggle.

### Scroll-to-top/bottom buttons (`ScrollToTopBottom`)

Two floating chevron buttons (up/down), watching a specific scroll
container via a passed-in `ref` (not `window.scroll`), using a
`ResizeObserver` (not just a scroll listener) since widget content lazy-
loads and changes the scrollable height after the initial mount. Each
button only renders when there's actually somewhere to jump to (hidden
near the top/bottom respectively) — never shows two arrows pointing the
same functional direction, never just sits there doing nothing on a short
page.

### CSS variable tokens already established (reuse the names, not necessarily the exact hex values)

```
--bg-app, --bg-panel, --bg-header, --bg-active, --border
--text-main, --text-muted
--accent-green, --accent-red, --accent-blue, --accent-orange
--header-height, --sidebar-width-expanded, --sidebar-width-collapsed, --widget-gap
--success-bg, --success-text, --warning, --warning-bg, --warning-text
```

Per the user's instruction: match the *idea* of the existing theme (this
semantic token set), not the specific color values — those can be
redesigned. What must carry over is the token names/semantics themselves,
since dozens of widgets' worth of future code will reference them by name.

## Part 2 — UI stack decision

### What the old project already has (checked, not assumed)

```json
"tailwindcss": "^3.4.3", "tailwind-merge": "^2.2.2", "autoprefixer", "postcss",
"recharts": "^2.15.4", "lucide-react": "^0.368.0", "zustand": "^5.0.9",
"date-fns": "^4.1.0", "dayjs": "^1.11.19"  // two date libs — part of the
                                             // inconsistency FRONTEND_TIME_
                                             // CONVENTIONS.md already flagged
```

**Tailwind is already installed and even has a `tailwind.config.js` that
bridges the exact semantic tokens above into Tailwind's color palette**
(`"accent-green": "var(--accent-green)"`, etc.) — but it's never actually
used. Every widget checked uses `.module.css` files, not Tailwind utility
classes. Zero `@radix-ui/*` packages, no `components/ui` folder — shadcn/ui
was never adopted there. So this isn't "bring in a foreign stack" — it's
finishing a start that already exists, on the same color tokens, cleanly
this time.

### Recommendation

| Layer | Pick | Why |
|---|---|---|
| UI primitives & shell | **shadcn/ui + Tailwind** | Genuinely worth doing for real this time — accessible dialogs/dropdowns/tabs the old project hand-rolled, composable, and the color-token bridge already half-exists |
| Icons | **lucide-react** (keep) | Already the icon library throughout the old project; zero migration cost, zero reason to change |
| Charts (indicator lines, sparklines, breadth/mood over time) | **Recharts (via shadcn Charts wrapper)** | Already the charting library in the old project (`SmartMoodChart`, `CascadeTrendWidget`, RVOL sparklines, etc.) — shadcn's chart components are a thin, gorgeous wrapper around the same library, not a replacement |
| Data tables (RSI Grid, Speed Breakers, Distance Tracker, Momentum Pulse) | **TanStack Table** | The old project hand-rolled sort/filter state per-widget; TanStack Table (shadcn's table block wraps it natively) is a real, low-risk upgrade for exactly this repeated pattern |
| Resizable panels | **react-resizable-panels** (shadcn-wrapped) | Not in the old project at all — genuinely new capability, useful if any future layout wants a drag-resizable chart/table split |
| Command palette | **cmdk** | Not in the old project — **decided 2026-09-25: build in from v1**, see below |
| Candlestick/OHLC charts | **not used** | **Decided 2026-09-25: no charting library needed** — the two "candle"-looking widgets are hand-drawn SVG, not real OHLC, same as the old project. See below |
| Date/time | Single shared module per `FRONTEND_TIME_CONVENTIONS.md` | Supersedes the old project's split `date-fns`/`dayjs`/raw-`Intl` mess — one module, `Intl.DateTimeFormat` only, no new date library needed |
| State | **Zustand (+ `persist` for settings)** | Already proven in the old project for exactly this (`useThemeStore.js`), reused as-is |

### Decided 2026-09-25

1. **No `lightweight-charts` / raw OHLC candlesticks.** Confirmed: this
   project doesn't plot real price candles at all, matching the old
   project exactly. What LOOKS like a "candle" in two widgets — **EMA
   Candle Wall** and **RSI Grid Wall** — is a hand-drawn custom SVG shape
   (body = cascade state, wick = counter-series, color = bull/bear/neutral;
   see the old project's `RSIGridWall.jsx` "RSI Candle SVG (W=48, H=88)"
   spec, already carried into this project's own `/api/ema-candle-wall`
   and `/api/rsi-grid-wall` backend data). These stay hand-rolled inline
   SVG, same as the old project — no charting library involved, none
   needed. Every other chart in this project is a normal Recharts
   line/area/bar plot over a derived metric (RSI, RVOL, netBullPct, etc.),
   not price. `lightweight-charts` is not needed anywhere in this app as
   currently scoped — revisit only if a genuine new feature needs real
   OHLC candles.
2. **`cmdk` command palette: yes, build it in from the start** (Cmd/Ctrl+K
   — jump to any widget or symbol). Not in the old project, but agreed as
   a real upgrade worth having from v1, not bolted on later.

### Additional UX patterns to preserve (confirmed 2026-09-25) — behavior over chrome

The user's instruction, stated plainly: **UI chrome (icons, buttons,
dropdowns, modals) can be modernized via shadcn/ui — the underlying
behavior/UX patterns below must not change.** Three specific patterns,
checked directly against the old project's code/docs, not assumed:

- **Per-widget settings persistence + scoped reset**, exactly the old
  project's documented pattern (its own CLAUDE.md "Widget Persistence
  Pattern," carried forward verbatim):

  ```js
  const LS_KEY = 'widgetName_prefs';
  const DEFAULTS = { windowMin: 120, intervalMin: 2 };

  function loadPrefs() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }
  // Save on change: localStorage.setItem(LS_KEY, JSON.stringify(newPrefs))
  // Reset button: localStorage.removeItem(LS_KEY), state -> DEFAULTS
  ```

  **Each widget's reset button only resets that widget** — never a
  global "reset everything" action. Every settings-bearing widget in this
  project (RSI Grid Wall, Distance Tracker, Momentum Pulse, Market
  Structure, etc.) gets its own `<id>_prefs` key, independently.

- **Per-widget "last updated" / freshness indicator**, same relative-time
  treatment as `timeAgo()` in `FRONTEND_TIME_CONVENTIONS.md` — every
  widget that polls its own endpoint shows its own freshness (`5m ago`,
  not a single global "data as of" line), since different widgets can
  legitimately be on different poll cadences.
- **Sleek, scrubbable range control on time-series charts.** Note: checked
  the old project's code for this specifically (grepped for Recharts'
  `Brush` component and any range-slider UI) — it does **not** actually
  exist there; the old project has no chart brush/scrubber anywhere. This
  is new guidance for this project, not a replication requirement: any
  time-series chart here with more than a screenful of history (Market
  Score history, Momentum Pulse sparklines, breadth-over-time) should get
  a real brush/range control (Recharts' own `<Brush>`, or shadcn Chart's
  equivalent) so the user can scrub/zoom, rather than a static fixed
  window.
