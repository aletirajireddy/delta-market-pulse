import { useState } from 'react';
import { TrendingUp, TrendingDown, Layers, Zap } from 'lucide-react';
import { useSentimentCascade } from '../../hooks/useSentimentCascade';
import { useSentimentSettingsStore } from '../../store/useSentimentSettingsStore';
import { STRUCTURAL_SERIES_PRESETS, REACTIVE_SERIES_PRESETS } from '../../utils/cascade';
import styles from './MarketBreadth.module.css';

function BreadthPair({ Icon, title, groups, rowKey, openKey, setOpenKey }) {
  function toggle(key) {
    setOpenKey((cur) => (cur === key ? null : key));
  }

  return (
    <div className={styles.pair} title={title}>
      <Icon size={12} className={styles.pairIcon} />
      <div
        className={styles.item}
        style={{ color: 'var(--accent-green)' }}
        onMouseEnter={() => setOpenKey(`${rowKey}-bull`)}
        onMouseLeave={() => setOpenKey((cur) => (cur === `${rowKey}-bull` ? null : cur))}
        onClick={() => toggle(`${rowKey}-bull`)}
      >
        <TrendingUp size={14} />
        {groups.bull.length}
        {openKey === `${rowKey}-bull` && (
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupTitle}>Bullish</div>
            {groups.bull.length === 0 && <div className={styles.empty}>None</div>}
            {groups.bull.map((base) => (
              <div key={base} className={styles.coin}>
                {base}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        className={styles.item}
        style={{ color: 'var(--accent-red)' }}
        onMouseEnter={() => setOpenKey(`${rowKey}-bear`)}
        onMouseLeave={() => setOpenKey((cur) => (cur === `${rowKey}-bear` ? null : cur))}
        onClick={() => toggle(`${rowKey}-bear`)}
      >
        <TrendingDown size={14} />
        {groups.bear.length}
        {openKey === `${rowKey}-bear` && (
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupTitle}>Bearish</div>
            {groups.bear.length === 0 && <div className={styles.empty}>None</div>}
            {groups.bear.map((base) => (
              <div key={base} className={styles.coin}>
                {base}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Single "BREADTH" label, matching the old app's header exactly — two
// compact pairs underneath (Layers icon = structural/slow, Zap icon =
// reactive/fast) instead of separate text sub-headers. Both recomputed
// live from the user's selected TF series (Settings > Data & Sentiment).
export function MarketBreadth() {
  const { structuralGroups, reactiveGroups, total } = useSentimentCascade();
  const [openKey, setOpenKey] = useState(null);
  const structuralSeriesKey = useSentimentSettingsStore((s) => s.structuralSeriesKey);
  const reactiveSeriesKey = useSentimentSettingsStore((s) => s.reactiveSeriesKey);
  const structuralLabel = STRUCTURAL_SERIES_PRESETS[structuralSeriesKey]?.label;
  const reactiveLabel = REACTIVE_SERIES_PRESETS[reactiveSeriesKey]?.label;

  return (
    <div className={styles.group}>
      <div className={styles.cardLabel} title={`Watchlist only (${total} coins)`}>
        BREADTH
      </div>
      <div className={styles.wrap}>
        <BreadthPair
          Icon={Layers}
          title={`Structural (${structuralLabel}) — slow, long-lookback trend`}
          groups={structuralGroups}
          rowKey="structural"
          openKey={openKey}
          setOpenKey={setOpenKey}
        />
        <BreadthPair
          Icon={Zap}
          title={`Reactive (${reactiveLabel}) — fast, reacts to today's move`}
          groups={reactiveGroups}
          rowKey="reactive"
          openKey={openKey}
          setOpenKey={setOpenKey}
        />
      </div>
    </div>
  );
}
