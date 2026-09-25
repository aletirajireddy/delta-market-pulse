import { useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { usePoll } from '../../hooks/usePoll';
import { useSentimentCascade } from '../../hooks/useSentimentCascade';
import { bucketMarketLabel } from './MarketGauge';
import { StateBadge } from '../widgets/shared/StateBadge';
import styles from './MobileFloatingBar.module.css';

const LABEL_VARIANT = { EUPHORIC: 'green', BULLISH: 'green', NEUTRAL: 'gray', BEARISH: 'red', PANIC: 'red' };

// Same expandable bottom-corner bubble mechanism as the old app's
// MobileFloatingBar. On mobile, HeaderStatsDeck (gauge/breadth) is
// hidden for space — this panel is where that quick-status info lives
// instead, alongside API connectivity + watchlist count (no A/B/C/D
// stream health here, no multi-stream pipeline in this project).
// Live-only: no REPLAY half of the badge.
export function MobileFloatingBar() {
  const [expanded, setExpanded] = useState(false);
  const { data: health } = usePoll('/health', 15000); // connectivity check, deliberately independent of the data-poll cadence
  const { data: watchlist } = usePoll('/api/watchlist');
  const { netBullPct, structuralGroups, reactiveGroups } = useSentimentCascade();
  const isLive = Boolean(health?.ok);

  return (
    <div className={styles.wrapper}>
      {expanded && (
        <div className={styles.panel}>
          <div className={styles.row}>
            <span>Market</span>
            {netBullPct != null ? (
              <StateBadge variant={LABEL_VARIANT[bucketMarketLabel(netBullPct)] || 'gray'}>
                {netBullPct.toFixed(0)} {bucketMarketLabel(netBullPct)}
              </StateBadge>
            ) : (
              <span>--</span>
            )}
          </div>
          <div className={styles.row}>
            <span title="EMA Position Code — price vs. m5/m15/h1/h4 EMA200 stack">Structural</span>
            <span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{structuralGroups.bull.length}</span>
              {' / '}
              <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{structuralGroups.bear.length}</span>
            </span>
          </div>
          <div className={styles.row}>
            <span title="Fast, reacts to today's move, your selected TF series">Reactive</span>
            <span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{reactiveGroups.bull.length}</span>
              {' / '}
              <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{reactiveGroups.bear.length}</span>
            </span>
          </div>
          <div className={styles.row}>
            <span>API</span>
            <StateBadge variant={isLive ? 'green' : 'red'}>{isLive ? 'Connected' : 'Offline'}</StateBadge>
          </div>
          <div className={styles.row}>
            <span>Watchlist</span>
            <span>{watchlist?.count ?? '--'} coins</span>
          </div>
        </div>
      )}
      <button
        className={`${styles.bubble} ${isLive && !expanded ? styles.bubbleLive : ''}`}
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Close' : 'Status'}
        aria-label="Status"
      >
        {isLive ? <Wifi size={18} /> : <WifiOff size={18} />}
      </button>
    </div>
  );
}
