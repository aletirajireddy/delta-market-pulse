import { useMemo } from 'react';
import { ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { usePoll } from '../../hooks/usePoll';
import { useChartBrush } from '../../hooks/useChartBrush';
import { useDisplaySettingsStore } from '../../store/useDisplaySettingsStore';
import { formatClock } from '../../utils/formatTime';

// Direct port of the old app's MarketHeartbeatIndicator: a compact
// ComposedChart + slim Brush living in the header stats deck, not just the
// full-size widget further down the page. Same netBullPct history the main
// Market Score widget already plots (docs/ARCHITECTURE_DECISIONS.md §7:
// aggregate cascade-based net bull/bear%, no new composite math) — this is
// a second, compact view of that same real data, not a new metric.
function CustomTooltip({ active, payload, timezone, timeFormat }) {
  if (active && payload && payload.length) {
    const p = payload[0].payload;
    return (
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 8px',
          fontSize: 11,
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{formatClock(p.ts, timezone, timeFormat)}</div>
        <div style={{ color: p.netBullPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
          {p.netBullPct >= 0 ? '+' : ''}
          {p.netBullPct?.toFixed(1)}%
        </div>
      </div>
    );
  }
  return null;
}

export function HeaderMarketChart() {
  const { data } = usePoll('/api/market-score?hours=6');
  const { timezone, timeFormat } = useDisplaySettingsStore();
  const history = data?.history;
  // Stable reference across renders when the underlying history hasn't
  // changed — a fresh array every render (e.g. from a bare .map()) would
  // otherwise re-trigger useChartBrush's effect in an infinite loop.
  // Also downsampled (same idea as the old app's MarketHeartbeatIndicator
  // MAX_PTS cap): at this compact header width, too many points crammed
  // into a narrow Brush makes Recharts' own index/pixel rounding oscillate
  // every render — a real infinite-loop bug hit while building this.
  const MAX_PTS = 90;
  const chartData = useMemo(() => {
    const src = history || [];
    const mapped = src.map((h) => ({
      ts: h.ts,
      bullArea: Math.max(0, h.netBullPct ?? 0),
      bearArea: Math.min(0, h.netBullPct ?? 0),
      netBullPct: h.netBullPct,
    }));
    if (mapped.length <= MAX_PTS) return mapped;
    const step = Math.ceil(mapped.length / MAX_PTS);
    const sampled = mapped.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== mapped[mapped.length - 1]) sampled.push(mapped[mapped.length - 1]);
    return sampled;
  }, [history]);
  const { brushRange, handleBrushChange } = useChartBrush('headerMarketChart_brush', chartData);

  if (chartData.length < 2) return null;

  return (
    <div style={{ width: 340, height: 53, position: 'relative' }} title="Net bull % — market breadth, not a price line">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="hdrBull" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="hdrBear" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-red)" stopOpacity={0} />
              <stop offset="95%" stopColor="var(--accent-red)" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
          <YAxis domain={[-100, 100]} hide />
          <Tooltip content={<CustomTooltip timezone={timezone} timeFormat={timeFormat} />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          <Area type="monotone" dataKey="bullArea" stroke="var(--accent-green)" strokeWidth={1} fill="url(#hdrBull)" isAnimationActive={false} />
          <Area type="monotone" dataKey="bearArea" stroke="var(--accent-red)" strokeWidth={1} fill="url(#hdrBear)" isAnimationActive={false} />
          <Brush
            dataKey="ts"
            height={8}
            travellerWidth={2}
            stroke="rgba(255,255,255,0.2)"
            fill="rgba(0,0,0,0.2)"
            tickFormatter={() => ''}
            startIndex={brushRange.startIndex}
            endIndex={brushRange.endIndex}
            onChange={handleBrushChange}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
