import { useSentimentCascade } from '../../hooks/useSentimentCascade';
import { MarketGauge, bucketMarketLabel } from './MarketGauge';
import { MarketBreadth } from './MarketBreadth';
import { HeaderMarketChart } from './HeaderMarketChart';
import styles from './HeaderStatsDeck.module.css';

// Same slot the old app's HeaderStatsDeck occupies (left of the header,
// next to the hamburger) — gauge + breadth + the compact sleek-slider
// market chart (old app's MarketHeartbeatIndicator), no stream-health grid.
// Gauge is recomputed live from EMA Position Code (Stream A's real mood
// driver — see useSentimentCascade.js / utils/positionCode.js).
export function HeaderStatsDeck() {
  const { netBullPct, total } = useSentimentCascade();
  const label = bucketMarketLabel(netBullPct ?? 0);

  return (
    <div className={styles.deck}>
      <div title={`Watchlist Net Flow % (${total} coins), EMA Position Code`}>
        <MarketGauge score={netBullPct ?? 0} label={label} />
      </div>
      <div className={styles.divider} />
      <MarketBreadth />
      <div className={styles.divider} />
      <div className={styles.group}>
        <div className={styles.cardLabel} title="Net Flow % history, watchlist only, backend's own cascade series (history can't be retroactively recomputed)">
          MARKET HEARTBEAT
        </div>
        <HeaderMarketChart />
      </div>
    </div>
  );
}
