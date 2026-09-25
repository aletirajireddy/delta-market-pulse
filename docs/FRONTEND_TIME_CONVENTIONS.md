# Frontend Time, Date-Format & Timezone Conventions

> **Read this before writing the first line of frontend code.** This is a
> binding spec, not a suggestion — the old project (`tv-recommendation-
> fullstack`) got this wrong in a way that's easy to repeat by accident, and
> the failure mode is specifically dangerous for how this app is actually
> used (see "Why this is a real problem" below). Written 2026-09-25, before
> any frontend code exists, so there's no legacy pattern to accidentally
> follow.

## The rule, in one sentence

**The backend always stores/emits absolute UTC instants. The frontend never
asks the browser/OS what timezone it's in — it asks one global app setting
(timezone + date format + time format), chosen explicitly by the user,
defaulting to Asia/Kolkata / `DD/MMM/YY` / 12h AM-PM.**

## Why this is a real problem, not a theoretical one

Checked the old project's actual code before writing this spec (not assumed
— `client/src/services/TimeService.js` and every widget that formats a
timestamp). Two real defects found:

1. **Inconsistent formatting.** A shared `TimeService.js` exists and is
   meant to be the single source of truth, but at least 6 widgets
   (`ConfluenceGrid.jsx`, `EMACascadeMonitor.jsx`, `FusionDashboard.jsx`,
   `CascadeTrendWidget.jsx`, `AlertFrequencyTimeline.jsx`, `BYCWidget.jsx`)
   bypass it and format independently — some via `date-fns`'s `format()`,
   some via raw `toLocaleTimeString()`/`toLocaleDateString()`, with
   different 12h/24h conventions between them.
2. **Nowhere, in any of them, is a timezone ever explicitly specified.**
   Every call relies on the browser/OS's local timezone implicitly. This
   "worked" only because the user has always viewed it from a device whose
   OS clock happens to be set to IST.

**The scenario that breaks this** (the user's own description, verified as
a real risk): the backend can run on a VM in a different geography (e.g. a
US datacenter). If that VM is accessed via Remote Desktop from India, the
*browser rendering the page* is running on that VM's OS — whose timezone
is wherever the VM physically is, not India. `toLocaleTimeString()` in that
browser would silently show US local time, with nothing on screen
indicating the switch. The person looking at the screen is in India; the
render pipeline (browser → OS clock) is not. Browser-locale detection
answers "where is this machine," never "what does the person looking at it
want."

## The architecture

### 1. Backend — no change needed, but stated explicitly for the record

Every timestamp `delta-market-pulse` stores or emits is already an absolute
instant, not a wall-clock string tied to any location — `coin_indicator_
snapshot.ts`, `coin_ticker_snapshot.ts`, `market_score_snapshot.ts`, etc.
are all `Date.now()` epoch milliseconds, and API responses send these raw
(`ts: 1790327177636`), never a pre-formatted local string. **Never format a
time server-side for display** — formatting is a frontend-only concern,
precisely because only the frontend knows which timezone/format the
*viewer* currently wants.

### 2. Frontend — one global settings store, reusing the old project's proven pattern

The old project already solved "one global, persisted, user-controlled
display setting" correctly for theme — `client/src/store/useThemeStore.js`:
Zustand + the `persist` middleware (auto-handles `localStorage`, survives
reloads, rehydrates on load), with an explicit `apply*()` step. **Reuse that
exact pattern** for time/date settings too, rather than a hand-rolled
`localStorage.getItem`/`setItem` pair — it's a proven convention in this
codebase's lineage, not a new one to invent.

```js
// store/useDisplaySettingsStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const TIMEZONES = {
  'Asia/Kolkata':     { label: 'India (IST)',   short: 'IST' },
  'UTC':              { label: 'UTC',            short: 'UTC' },
  'America/New_York': { label: 'US Eastern (ET)', short: 'ET' },
};

export const DATE_FORMATS = {
  'DD/MMM/YY':   { label: '25/Sep/26' },
  'DD/MM/YYYY':  { label: '25/09/2026' },
  'YYYY-MM-DD':  { label: '2026-09-25 (ISO)' },
  'MMM DD, YYYY':{ label: 'Sep 25, 2026' },
};

export const TIME_FORMATS = {
  '12h': { label: '02:32:07 PM' },
  '24h': { label: '14:32:07' },
};

export const useDisplaySettingsStore = create(
  persist(
    (set) => ({
      timezone: 'Asia/Kolkata',     // NEVER auto-detected from the browser/OS
      dateFormat: 'DD/MMM/YY',
      timeFormat: '12h',
      setTimezone: (tz) => set({ timezone: tz }),
      setDateFormat: (fmt) => set({ dateFormat: fmt }),
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),
    }),
    { name: 'display-settings-storage' } // localStorage key, same convention as 'dashboard-theme-storage'
  )
);
```

A settings control (dropdowns — exact placement, e.g. header vs. a settings
panel, is a normal frontend design decision, not part of this spec) lets the
user change any of the three independently. Keep the timezone list to the
three above unless a real second use case shows up — don't pre-build a
400-entry IANA picker nobody asked for. Same restraint applies to date/time
format options: the four/two above cover realistic needs; add more only on
actual request.

**Theme itself**: not part of this spec (covered by its own store when the
frontend is scaffolded), but follow the exact same `useThemeStore.js`
pattern from the old project (Zustand + `persist`, CSS custom properties
applied to `document.documentElement`, light/dark modes via the same
`--bg-app`/`--text-main`/etc. variable names already documented in the old
project's CLAUDE.md "CSS Variable System" section) — don't design a new
theme mechanism from scratch when a working one already exists to copy.

### 3. One shared formatting module — every widget imports it, none format independently

`Intl.DateTimeFormat`'s built-in styles can't produce arbitrary patterns
like `DD/MMM/YY` directly (its "short"/"medium" styles are locale-dependent
and don't match this project's exact picker options) — so pull the parts
out with `formatToParts()` (always passing `timeZone` explicitly) and
assemble them ourselves. This also sidesteps `Intl`'s inconsistent zone-
abbreviation output (IST often renders as "GMT+5:30", not "IST", depending
on browser/ICU version) by using our own `TIMEZONES[...].short` label
instead of trusting `timeZoneName`.

```js
// utils/formatTime.js
import { TIMEZONES, DATE_FORMATS } from '../store/useDisplaySettingsStore';

function getParts(ts, tz, opts) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(new Date(ts));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// ts: epoch ms or ISO string (always UTC-based, straight from the API).
// tz/dateFormat/timeFormat: read from useDisplaySettingsStore by the caller
// and passed explicitly — never defaulted silently inside this module.
export function formatDate(ts, tz, dateFormat) {
  if (ts == null) return '--';
  const p = getParts(ts, tz, { day: '2-digit', month: 'short', year: 'numeric' });
  const yy = p.year.slice(-2);
  switch (dateFormat) {
    case 'DD/MM/YYYY':   return `${p.day}/${monthNum(p.month)}/${p.year}`;
    case 'YYYY-MM-DD':   return `${p.year}-${monthNum(p.month)}-${p.day}`;
    case 'MMM DD, YYYY': return `${p.month} ${p.day}, ${p.year}`;
    case 'DD/MMM/YY':
    default:              return `${p.day}/${p.month}/${yy}`;
  }
}

export function formatClock(ts, tz, timeFormat) {
  if (ts == null) return '--:--:--';
  if (timeFormat === '24h') {
    const p = getParts(ts, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${p.hour}:${p.minute}:${p.second}`;
  }
  const p = getParts(ts, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${p.hour}:${p.minute}:${p.second} ${p.dayPeriod}`; // e.g. "02:32:07 PM"
}

// Combined display, with the dynamic zone label — never a hardcoded "IST".
export function formatDateTime(ts, tz, dateFormat, timeFormat) {
  if (ts == null) return '--';
  const zoneLabel = TIMEZONES[tz]?.short || tz;
  return `${formatDate(ts, tz, dateFormat)}, ${formatClock(ts, tz, timeFormat)} ${zoneLabel}`;
}

// Relative time needs no timezone/format at all — it's a duration, not a
// wall-clock read. Kept separate so nobody's tempted to derive it from a
// formatted string.
export function timeAgo(ts) {
  if (ts == null) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function monthNum(shortMonth) {
  return String(new Date(`${shortMonth} 1, 2000`).getMonth() + 1).padStart(2, '0');
}
```

Every widget reads `{ timezone, dateFormat, timeFormat }` from
`useDisplaySettingsStore` and calls `formatDate`/`formatClock`/
`formatDateTime`/`timeAgo` — **no widget ever calls `new Date(...)
.toLocaleTimeString()`, `date-fns`'s `format()`, or any other formatter
directly.** That's the exact pattern that let 6 widgets in the old project
silently drift out of sync with each other and with the timezone question
entirely.

### 4. Everything is dynamic, nothing is hardcoded

Both the zone label (`TIMEZONES[tz].short`) and the date/time pattern are
read from the live setting, not baked into any widget. If the user switches
timezone to `America/New_York`, every timestamp on screen relabels to `ET`
automatically. If they switch date format to ISO, every date on screen
follows, with zero per-widget code changes.

## Defaults (current, per explicit user instruction 2026-09-25)

| Setting | Default | Example |
|---|---|---|
| Timezone | `Asia/Kolkata` | — |
| Date format | `DD/MMM/YY` | `25/Sep/26` |
| Time format | `12h` (AM/PM) | `02:32:07 PM` |
| Combined | — | `25/Sep/26, 02:32:07 PM IST` |
| Freshness (no format needed) | relative | `5m ago` |

## What this means for whoever builds the frontend

1. Scaffold `store/useDisplaySettingsStore.js` and `utils/formatTime.js` as
   part of the FIRST frontend commit, before any widget that displays a
   timestamp.
2. Every widget imports both — never formats a date independently.
3. If a new format need comes up (e.g. a chart axis tick), add it to
   `formatTime.js` as a new named export, not as an inline
   `toLocaleString()` call in the widget — same discipline as
   `DataAuthority.js` on the backend side (one resolver, not N ad-hoc
   copies).
4. Theme follows the old project's `useThemeStore.js` pattern verbatim
   (copy the mechanism, pick new colors as needed) — don't invent a second
   theming approach.
