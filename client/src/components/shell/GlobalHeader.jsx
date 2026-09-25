import { useState } from 'react';
import { Menu, Settings } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { HeaderStatsDeck } from './HeaderStatsDeck';
import { LiveClock } from './LiveClock';
import { NotificationBell } from './NotificationBell';
import { SettingsPanel } from '../settings/SettingsPanel';
import styles from './GlobalHeader.module.css';

// Two-zone header, same shape as the old app's GlobalHeader: left =
// hamburger + stats deck (gauge/breadth), right = live clock, alerts
// bell, settings gear. No live/replay status glyph, no coin-mask or
// volume-unit toggles, no stream-health grid — all TV-pipeline-specific
// and dropped for this project.
export function GlobalHeader() {
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.hamburgerBtn}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <span className={styles.brand}>Delta Market Pulse</span>
        <HeaderStatsDeck />
      </div>
      <div className={styles.right}>
        <LiveClock />
        <NotificationBell />
        <button className={styles.iconBtn} onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <Settings size={18} />
        </button>
      </div>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
