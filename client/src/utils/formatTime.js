import { TIMEZONES } from '../store/useDisplaySettingsStore';

// Per docs/FRONTEND_TIME_CONVENTIONS.md — binding spec, copied verbatim.
// Every widget imports this module; none format a date independently.

function getParts(ts, tz, opts) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(new Date(ts));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

function monthNum(shortMonth) {
  return String(new Date(`${shortMonth} 1, 2000`).getMonth() + 1).padStart(2, '0');
}

// ts: epoch ms or ISO string (always UTC-based, straight from the API).
export function formatDate(ts, tz, dateFormat) {
  if (ts == null) return '--';
  const p = getParts(ts, tz, { day: '2-digit', month: 'short', year: 'numeric' });
  const yy = p.year.slice(-2);
  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${p.day}/${monthNum(p.month)}/${p.year}`;
    case 'YYYY-MM-DD':
      return `${p.year}-${monthNum(p.month)}-${p.day}`;
    case 'MMM DD, YYYY':
      return `${p.month} ${p.day}, ${p.year}`;
    case 'DD/MMM/YY':
    default:
      return `${p.day}/${p.month}/${yy}`;
  }
}

export function formatClock(ts, tz, timeFormat) {
  if (ts == null) return '--:--:--';
  if (timeFormat === '24h') {
    const p = getParts(ts, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${p.hour}:${p.minute}:${p.second}`;
  }
  const p = getParts(ts, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${p.hour}:${p.minute}:${p.second} ${p.dayPeriod}`;
}

// Combined display, with the dynamic zone label — never a hardcoded "IST".
export function formatDateTime(ts, tz, dateFormat, timeFormat) {
  if (ts == null) return '--';
  const zoneLabel = TIMEZONES[tz]?.short || tz;
  return `${formatDate(ts, tz, dateFormat)}, ${formatClock(ts, tz, timeFormat)} ${zoneLabel}`;
}

// Relative time needs no timezone/format at all — it's a duration.
export function timeAgo(ts) {
  if (ts == null) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
