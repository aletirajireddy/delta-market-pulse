// Small colored dot with a matching-color glow, ported from the old
// app's EMACascadeMonitor "cascadeDot" pattern. `null` cascade means no
// indicator snapshot exists yet for that coin — rendered as an empty
// outline, never defaulted to a fake "neutral" state.
const COLOR = { bull: 'var(--accent-green)', bear: 'var(--accent-red)', neutral: 'var(--text-muted)' };

export function StateDot({ state, pulse = false, title }) {
  if (!state) {
    return (
      <span
        title={title || 'No data yet'}
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: '1px solid var(--border)',
        }}
      />
    );
  }
  const color = COLOR[state] || COLOR.neutral;
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 4px ${color}`,
        animation: pulse ? 'dotGlowPulse 1.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}
