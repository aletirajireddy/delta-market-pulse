// Zone-shaded 0-100 gauge bar, ported from the old app's SpeedbreakerBar
// pattern: oversold/overbought zones tinted, a 50 pivot line, and a
// colored marker at the actual value. Renders nothing but an empty track
// when `value` is null (no fabricated position).
export function RsiZoneBar({ value, oversold = 30, overbought = 70, pullback = false }) {
  const pos = (v) => Math.max(0, Math.min(100, v));

  let markerColor = 'var(--text-muted)';
  if (value != null) {
    if (value < oversold) markerColor = 'var(--accent-green)';
    else if (value > overbought) markerColor = 'var(--accent-red)';
    else if (pullback) markerColor = 'var(--warning)';
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 14,
        borderRadius: 4,
        border: '1px solid var(--border)',
        background: 'var(--bg-app)',
        overflow: 'hidden',
        boxShadow: pullback ? '0 0 6px 1px rgba(245,158,11,0.35)' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${pos(oversold)}%`,
          height: '100%',
          background: 'rgba(16,185,129,0.14)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${pos(overbought)}%`,
          right: 0,
          height: '100%',
          background: 'rgba(239,68,68,0.14)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          background: 'var(--border)',
        }}
      />
      {value != null && (
        <div
          style={{
            position: 'absolute',
            left: `${pos(value)}%`,
            top: 1,
            bottom: 1,
            width: 4,
            marginLeft: -2,
            borderRadius: 2,
            background: markerColor,
            boxShadow: `0 0 3px ${markerColor}`,
          }}
        />
      )}
    </div>
  );
}
