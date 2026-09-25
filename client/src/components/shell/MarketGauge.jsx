import { useEffect, useMemo, useState } from 'react';

// Direct port of tv-recommendation-fullstack's SpeedometerGauge.jsx:
// hand-rolled SVG semicircle (no charting library), gradient arc track,
// rotating needle with a bouncy transition, tick marks every 20 points.
// Score range is -100..100 (matches this project's netBullPct), mapped to
// a -90deg..+90deg needle angle, 0deg = straight up.
export function MarketGauge({ score = 0, label = 'NEUTRAL' }) {
  const clampedScore = Math.max(-100, Math.min(100, score ?? 0));
  const [animatedScore, setAnimatedScore] = useState(-100);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedScore(clampedScore), 50);
    return () => clearTimeout(t);
  }, [clampedScore]);

  const angle = (animatedScore / 100) * 90;

  const ticks = useMemo(() => {
    const out = [];
    for (let v = -100; v <= 100; v += 20) {
      const tickAngle = (v / 100) * 90;
      const major = v % 50 === 0;
      out.push({ value: v, angle: tickAngle, major });
    }
    return out;
  }, []);

  const labelColor =
    {
      BULLISH: 'var(--accent-green)',
      EUPHORIC: 'var(--accent-green)',
      BEARISH: 'var(--accent-red)',
      PANIC: 'var(--accent-red)',
      NEUTRAL: 'var(--text-muted)',
    }[label] || 'var(--text-muted)';

  return (
    <svg viewBox="0 0 200 110" width="96" height="53" role="img" aria-label={`Market gauge: ${label}, ${Math.round(clampedScore)}`}>
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-red)" />
          <stop offset="50%" stopColor="var(--warning)" />
          <stop offset="100%" stopColor="var(--accent-green)" />
        </linearGradient>
      </defs>
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="url(#gaugeGradient)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {ticks.map((t) => (
        <line
          key={t.value}
          x1="100"
          y1="24"
          x2="100"
          y2={t.major ? 14 : 18}
          stroke="var(--text-muted)"
          strokeWidth={t.major ? 2 : 1}
          transform={`rotate(${t.angle}, 100, 100)`}
        />
      ))}
      <polygon
        points="100,40 96,100 104,100"
        fill="var(--text-main)"
        style={{
          transformOrigin: '100px 100px',
          transform: `rotate(${angle}deg)`,
          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      <circle cx="100" cy="100" r="5" fill="var(--text-main)" />
      <text x="100" y="90" textAnchor="middle" fontSize="16" fontWeight="700" fill={labelColor}>
        {clampedScore > 0 ? `+${Math.round(clampedScore)}` : Math.round(clampedScore)}
      </text>
      <text x="100" y="105" textAnchor="middle" fontSize="9" fontWeight="600" fill={labelColor} letterSpacing="0.5">
        {label}
      </text>
    </svg>
  );
}

// Exact thresholds from the old app's GenieSmart.analyzeMarketMood() —
// its own honest "Net Flow %" formula (same math this project's
// marketScore.js already implements), not the composite score it used to
// also compute (removed there 2026-09-24, same anti-pattern this project
// avoids). >=60 EUPHORIC, >=20 BULLISH, <=-20 BEARISH, <=-60 PANIC.
export function bucketMarketLabel(netBullPct) {
  if (netBullPct == null) return 'NEUTRAL';
  if (netBullPct >= 60) return 'EUPHORIC';
  if (netBullPct >= 20) return 'BULLISH';
  if (netBullPct <= -60) return 'PANIC';
  if (netBullPct <= -20) return 'BEARISH';
  return 'NEUTRAL';
}
