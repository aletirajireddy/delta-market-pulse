import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, Tooltip, Brush, CartesianGrid } from 'recharts';
import { usePoll } from '../../../hooks/usePoll';
import { useChartBrush } from '../../../hooks/useChartBrush';
import { useDisplaySettingsStore } from '../../../store/useDisplaySettingsStore';
import { formatClock } from '../../../utils/formatTime';
import { WidgetCard } from '../WidgetCard';

export function MarketScore() {
  const { data, lastUpdatedTs } = usePoll('/api/market-score?hours=6');
  const { timezone, timeFormat } = useDisplaySettingsStore();
  const history = data?.history || [];
  const { brushRange, handleBrushChange } = useChartBrush('marketScore_brush', history);
  const latest = data?.latest;

  return (
    <WidgetCard
      id="market-score"
      title="Market Score"
      lastUpdatedTs={lastUpdatedTs}
      actions={
        brushRange.isLive ? (
          <span style={{ color: 'var(--accent-green)', fontSize: 11, fontWeight: 700 }}>&#9679; LIVE</span>
        ) : null
      }
    >
      <div style={{ display: 'flex', gap: 20, marginBottom: 10, fontSize: 13 }}>
        <span>
          Net bull: <strong style={{ color: 'var(--accent-green)' }}>{latest?.netBullPct?.toFixed(1) ?? '--'}%</strong>
        </span>
        <span style={{ color: 'var(--accent-green)' }}>Bull {latest?.bullCount ?? '--'}</span>
        <span style={{ color: 'var(--accent-red)' }}>Bear {latest?.bearCount ?? '--'}</span>
        <span style={{ color: 'var(--text-muted)' }}>Neutral {latest?.neutralCount ?? '--'}</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(ts) => formatClock(ts, timezone, timeFormat).slice(0, 5)}
            stroke="var(--text-muted)"
            fontSize={11}
          />
          <YAxis domain={[-100, 100]} stroke="var(--text-muted)" fontSize={11} />
          <Tooltip
            labelFormatter={(ts) => formatClock(ts, timezone, timeFormat)}
            contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="netBullPct"
            stroke="var(--accent-blue)"
            fill="var(--accent-blue)"
            fillOpacity={0.15}
            isAnimationActive={false}
          />
          <Brush
            dataKey="ts"
            height={10}
            travellerWidth={6}
            stroke="rgba(255,255,255,0.15)"
            fill="rgba(0,0,0,0.25)"
            tickFormatter={() => ''}
            startIndex={brushRange.startIndex}
            endIndex={brushRange.endIndex}
            onChange={handleBrushChange}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
