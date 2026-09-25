const COLORS = {
  bull: 'var(--accent-green)',
  bear: 'var(--accent-red)',
  neutral: 'var(--text-muted)',
};

// Hand-drawn inline SVG "candle" (W=48, H=88, per docs/
// FRONTEND_LAYOUT_AND_STACK.md) — NOT a real OHLC candle. Body = long-
// series cascade state (h4/h1/m15 EMA200 spread around price), wick =
// fast counter series (m5/m1 spread), color = bull/bear/neutral. No
// charting library — same hand-rolled approach as the old project's
// RSI/EMA candle walls.
export function Candle({ price, body, wick, cascade, counterCascade, expanded }) {
  const bodyColor = COLORS[cascade] || COLORS.neutral;
  const wickColor = COLORS[counterCascade] || COLORS.neutral;

  // Normalize edges to a %-distance-from-price, clamp to a fixed visual
  // range so wildly different price scales all render at a readable size.
  const pct = (v) => {
    if (v == null || !price) return 0;
    const p = ((v - price) / price) * 100;
    return Math.max(-6, Math.min(6, p));
  };

  const cy = 44;
  const scale = 5.5; // px per % distance
  const bodyTopY = cy - pct(body?.top) * scale;
  const bodyBottomY = cy - pct(body?.bottom) * scale;
  const wickTopY = cy - pct(wick?.top) * scale;
  const wickBottomY = cy - pct(wick?.bottom) * scale;

  return (
    <svg viewBox="0 0 48 88" width="48" height="88">
      <line x1="24" y1={Math.min(wickTopY, bodyTopY)} x2="24" y2={Math.max(wickBottomY, bodyBottomY)} stroke={wickColor} strokeWidth="2" />
      <rect
        x="10"
        y={Math.min(bodyTopY, bodyBottomY)}
        width="28"
        height={Math.max(2, Math.abs(bodyBottomY - bodyTopY))}
        fill={bodyColor}
        opacity={expanded ? 1 : 0.65}
        rx="2"
      />
      <line x1="6" y1={cy} x2="42" y2={cy} stroke="var(--text-muted)" strokeDasharray="2 2" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
