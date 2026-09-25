import { useSentimentCascade } from '../../hooks/useSentimentCascade';
import { MarketGauge, bucketMarketLabel } from './MarketGauge';
import { MarketBreadth } from './MarketBreadth';
import { HeaderMarketChart } from './HeaderMarketChart';
import styles from './HeaderStatsDeck.module.css';

// Same slot the old app's HeaderStatsDeck occupies (left of the header,
// next to the hamburger) — gauge + breadth + the compact sleek-slider
// market chart (old app's MarketHeartbeatIndicator), no stream-health grid.
// Gauge is recomputed live from the user's selected sentiment TF series
// (Settings > Data & Sentiment) — see useSentimentCascade.
export function HeaderStatsDeck() {
  const { netBullPct, total } = useSentimentCascade();
  const label = bucketMarketLabel(netBullPct ?? 0);

  return (
    <div className={styles.deck}>
      <div title={`Watchlist Net Flow % (${total} coins), your selected structural TF series`}>
        <MarketGauge score={netBullPct ?? 0} label={label} />
      </div>
      <div className={styles.divider} />
      <MarketBreadth />
      <div className={styles.divider} />
      <div className={styles.group}>
        <div className={styles.cardLabel} title="Net Flow % history, watchlist only, default TF series (history can't be retroactively recomputed)">
          MARKET HEARTBEAT
        </div>
        <HeaderMarketChart />
      </div>
    </div>
  );
}
