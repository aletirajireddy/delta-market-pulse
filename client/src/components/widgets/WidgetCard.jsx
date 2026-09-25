import { timeAgo } from '../../utils/formatTime';
import styles from './WidgetCard.module.css';

// Shared shell for widget panels: title + per-widget freshness indicator
// (each widget polls its own endpoint on its own cadence, per
// docs/FRONTEND_LAYOUT_AND_STACK.md).
export function WidgetCard({ id, title, subtitle, lastUpdatedTs, actions, children }) {
  return (
    <section id={`section-${id}`} className={styles.card}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>{title}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {actions}
          <span className={styles.freshness}>{lastUpdatedTs ? timeAgo(lastUpdatedTs) : ''}</span>
        </div>
      </div>
      {children}
    </section>
  );
}
