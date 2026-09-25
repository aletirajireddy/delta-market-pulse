import { useState } from 'react';
import { Bell } from 'lucide-react';
import { usePoll } from '../../hooks/usePoll';
import { apiPost } from '../../utils/api';
import { useDisplaySettingsStore } from '../../store/useDisplaySettingsStore';
import { formatDateTime } from '../../utils/formatTime';
import { StateBadge } from '../widgets/shared/StateBadge';
import styles from './NotificationBell.module.css';

const STATE_VARIANT = { qualified: 'amber', active: 'green', expired: 'gray' };

// Direct analog of the old app's SmartAlertsBell, backed by this
// project's own Smart Alerts API.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unreadData, error: unreadErr } = usePoll('/api/smart-alerts/unread-count');
  const { data: listData } = usePoll(open ? '/api/smart-alerts?limit=20' : null);
  const { timezone, dateFormat, timeFormat } = useDisplaySettingsStore();

  const unread = unreadErr ? 0 : unreadData?.unread ?? 0;

  async function markAllRead() {
    try {
      await apiPost('/api/smart-alerts/mark-all-read');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span>Smart Alerts</span>
            <button className={styles.markRead} onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          {(!listData?.alerts || listData.alerts.length === 0) && <div className={styles.empty}>No alerts</div>}
          {listData?.alerts?.map((a) => (
            <div
              key={a.id}
              className={styles.alertRow}
              style={a.is_unread ? { borderLeft: '2px solid var(--warning)' } : undefined}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{a.base}</strong>
                <span style={{ color: 'var(--text-muted)' }}>{a.timeframe}</span>
                <StateBadge variant={STATE_VARIANT[a.state] || 'gray'}>{a.state}</StateBadge>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>
                {formatDateTime(a.created_at, timezone, dateFormat, timeFormat)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
