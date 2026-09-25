// Pill/rect badge convention ported from the old app's cascade/status
// badges: colored text + tinted background + matching-alpha border. All
// three colors are CSS vars, so it follows whatever theme is active.
const VARIANTS = {
  green: { text: 'var(--accent-green)', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)' },
  red: { text: 'var(--accent-red)', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)' },
  amber: { text: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)' },
  gray: { text: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.25)' },
};

export function StateBadge({ variant = 'gray', pill = true, children }) {
  const c = VARIANTS[variant] || VARIANTS.gray;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: pill ? 10 : 4,
        padding: pill ? '2px 8px' : '1px 5px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
