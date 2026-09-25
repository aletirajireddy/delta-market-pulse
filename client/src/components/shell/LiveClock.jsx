import { useEffect, useState } from 'react';
import { useDisplaySettingsStore } from '../../store/useDisplaySettingsStore';
import { formatDate, formatClock } from '../../utils/formatTime';
import { TIMEZONES } from '../../store/useDisplaySettingsStore';

// Prominent header clock, ticking every second, driven entirely by the
// global display-settings store — never the browser/OS clock's timezone.
export function LiveClock() {
  const [now, setNow] = useState(Date.now());
  const { timezone, dateFormat, timeFormat } = useDisplaySettingsStore();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.3 }}>
      <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{formatClock(now, timezone, timeFormat)}</div>
      <div>
        {formatDate(now, timezone, dateFormat)} {TIMEZONES[timezone]?.short || timezone}
      </div>
    </div>
  );
}
