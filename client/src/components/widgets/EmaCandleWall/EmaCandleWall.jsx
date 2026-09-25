import { useEmaCandleWall } from '../../../hooks/useEmaCandleWall';
import { WidgetCard } from '../WidgetCard';
import { Candle } from './Candle';
import { formatPrice } from '../../../utils/formatPrice';
import styles from './EmaCandleWall.module.css';

export function EmaCandleWall() {
  const { data, lastUpdatedTs } = useEmaCandleWall();

  return (
    <WidgetCard
      id="ema-candle-wall"
      title={`EMA Candle Wall (${data?.count ?? '--'})`}
      subtitle="Body = 4h/1h/15m EMA200 spread around price (long-term cascade). Wick = 5m/1m spread (fast counter-move). Not a real OHLC candle."
      lastUpdatedTs={lastUpdatedTs}
    >
      <div className={styles.grid}>
        {data?.coins?.map((c) => (
          <div key={c.base} className={styles.cell}>
            <Candle
              price={c.price}
              body={c.body}
              wick={c.wick}
              cascade={c.cascade}
              counterCascade={c.counterCascade}
              expanded={c.expanded}
            />
            <div className={styles.base}>{c.base}</div>
            <div className={styles.price}>${formatPrice(c.price)}</div>
            <div
              className={styles.change}
              style={{ color: c.changePct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
            >
              {c.changePct != null ? `${c.changePct >= 0 ? '+' : ''}${c.changePct.toFixed(2)}%` : '--'}
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
