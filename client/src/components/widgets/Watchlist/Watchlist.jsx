import { usePoll } from '../../../hooks/usePoll';
import { useEmaCandleWall } from '../../../hooks/useEmaCandleWall';
import { useDisplaySettingsStore } from '../../../store/useDisplaySettingsStore';
import { formatDateTime } from '../../../utils/formatTime';
import { formatPrice } from '../../../utils/formatPrice';
import { WidgetCard } from '../WidgetCard';
import { StateBadge } from '../shared/StateBadge';
import { StateDot } from '../shared/StateDot';
import styles from './Watchlist.module.css';

const STATUS_VARIANT = { qualifying: 'amber', active: 'green', ghosted: 'gray' };
const STATUS_BORDER = { qualifying: 'var(--warning)', active: 'var(--accent-green)', ghosted: 'var(--border)' };

export function Watchlist() {
  const { data, lastUpdatedTs } = usePoll('/api/watchlist');
  // /api/watchlist itself carries no price/cascade — those come from the
  // same indicator snapshot EMA Candle Wall already polls, joined by base.
  // Real fields only; coins with no indicator snapshot yet (freshly
  // qualifying) show '--', never a guessed value.
  const { data: candleData } = useEmaCandleWall();
  const candleByBase = new Map((candleData?.coins || []).map((c) => [c.base, c]));
  const { timezone, dateFormat, timeFormat } = useDisplaySettingsStore();

  return (
    <WidgetCard
      id="watchlist"
      title={`Watchlist (${data?.count ?? '--'})`}
      subtitle="Coins currently qualifying, active, or ghosted. Price/cascade dot shown once an indicator snapshot exists for that coin."
      lastUpdatedTs={lastUpdatedTs}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th></th>
            <th>Base</th>
            <th>Price</th>
            <th>Status</th>
            <th>Qualifying since</th>
            <th>Graduated</th>
            <th>Last active</th>
          </tr>
        </thead>
        <tbody>
          {data?.coins?.map((c) => {
            const candle = candleByBase.get(c.base);
            return (
              <tr key={c.base} style={{ borderLeft: `2px solid ${STATUS_BORDER[c.status] || 'var(--border)'}` }}>
                <td>
                  <StateDot state={candle?.cascade} title={candle?.cascade || 'No indicator data yet'} />
                </td>
                <td className={styles.base}>{c.base}</td>
                <td className="tabular-nums">{candle?.price != null ? `$${formatPrice(candle.price)}` : '--'}</td>
                <td>
                  <StateBadge variant={STATUS_VARIANT[c.status] || 'gray'}>{c.status}</StateBadge>
                </td>
                <td className="tabular-nums">{formatDateTime(c.qualifying_since, timezone, dateFormat, timeFormat)}</td>
                <td className="tabular-nums">{formatDateTime(c.graduated_at, timezone, dateFormat, timeFormat)}</td>
                <td className="tabular-nums">{formatDateTime(c.last_active_at, timezone, dateFormat, timeFormat)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </WidgetCard>
  );
}
