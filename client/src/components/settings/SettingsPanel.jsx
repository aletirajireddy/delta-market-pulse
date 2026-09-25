import { X } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { useDisplaySettingsStore, TIMEZONES, DATE_FORMATS, TIME_FORMATS } from '../../store/useDisplaySettingsStore';
import { useNotificationSettingsStore } from '../../store/useNotificationSettingsStore';
import { useSentimentSettingsStore, POLL_INTERVALS } from '../../store/useSentimentSettingsStore';
import { STRUCTURAL_SERIES_PRESETS, REACTIVE_SERIES_PRESETS } from '../../utils/cascade';
import styles from './SettingsPanel.module.css';

function Switch({ on, onToggle, label }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <button
        className={`${styles.switch} ${on ? styles.switchOn : ''}`}
        onClick={() => onToggle(!on)}
        aria-pressed={on}
        aria-label={label}
      >
        <span className={styles.switchKnob} />
      </button>
    </div>
  );
}

export function SettingsPanel({ onClose }) {
  const { themeMode, setThemeMode } = useThemeStore();
  const { timezone, dateFormat, timeFormat, setTimezone, setDateFormat, setTimeFormat } = useDisplaySettingsStore();
  const { inAppAlertsEnabled, telegramEnabled, setInAppAlertsEnabled, setTelegramEnabled } =
    useNotificationSettingsStore();
  const {
    structuralSeriesKey,
    reactiveSeriesKey,
    pollIntervalMs,
    setStructuralSeriesKey,
    setReactiveSeriesKey,
    setPollIntervalMs,
  } = useSentimentSettingsStore();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>Settings</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Theme</div>
          <div className={styles.row}>
            <span className={styles.label}>Mode</span>
            <div className={styles.toggle}>
              <button
                className={`${styles.toggleBtn} ${themeMode === 'dark' ? styles.toggleBtnActive : ''}`}
                onClick={() => setThemeMode('dark')}
              >
                Dark
              </button>
              <button
                className={`${styles.toggleBtn} ${themeMode === 'light' ? styles.toggleBtnActive : ''}`}
                onClick={() => setThemeMode('light')}
              >
                Light
              </button>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Date &amp; Time</div>
          <div className={styles.row}>
            <span className={styles.label}>Timezone</span>
            <select className={styles.select} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {Object.entries(TIMEZONES).map(([tz, meta]) => (
                <option key={tz} value={tz}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Date format</span>
            <select className={styles.select} value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              {Object.entries(DATE_FORMATS).map(([fmt, meta]) => (
                <option key={fmt} value={fmt}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Time format</span>
            <select className={styles.select} value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)}>
              {Object.entries(TIME_FORMATS).map(([fmt, meta]) => (
                <option key={fmt} value={fmt}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Data &amp; Sentiment</div>
          <div className={styles.row}>
            <span className={styles.label} title="Backend indicator snapshots refresh on their own ~60s cycle — polling faster just re-fetches the same values">
              Poll interval
            </span>
            <select
              className={styles.select}
              value={pollIntervalMs}
              onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            >
              {Object.entries(POLL_INTERVALS).map(([ms, meta]) => (
                <option key={ms} value={ms}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <span className={styles.label} title="Drives Gauge/Breadth's slow trend reading">
              Structural TF series
            </span>
            <select
              className={styles.select}
              value={structuralSeriesKey}
              onChange={(e) => setStructuralSeriesKey(e.target.value)}
            >
              {Object.entries(STRUCTURAL_SERIES_PRESETS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <span className={styles.label} title="Drives Breadth's fast, reactive reading">
              Reactive TF series
            </span>
            <select
              className={styles.select}
              value={reactiveSeriesKey}
              onChange={(e) => setReactiveSeriesKey(e.target.value)}
            >
              {Object.entries(REACTIVE_SERIES_PRESETS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Notifications</div>
          <Switch on={inAppAlertsEnabled} onToggle={setInAppAlertsEnabled} label="In-app Smart Alerts" />
          <Switch on={telegramEnabled} onToggle={setTelegramEnabled} label="Telegram (coming soon)" />
        </div>
      </div>
    </div>
  );
}
