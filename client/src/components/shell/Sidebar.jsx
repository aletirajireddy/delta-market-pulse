import { useEffect } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { WIDGET_SECTIONS } from '../../config/widgetSections';
import { scrollToSection } from '../../utils/scrollToSection';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useUIStore();

  // Body scroll lock + ESC-to-close while the mobile drawer is open —
  // ported from the old app's Sidebar.jsx mechanics exactly.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen, setMobileMenuOpen]);

  async function handleNavClick(id) {
    await scrollToSection(id);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  return (
    <>
      {mobileMenuOpen && <div className={styles.backdrop} onClick={() => setMobileMenuOpen(false)} />}
      <aside
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''} ${
          mobileMenuOpen ? styles.mobileOpen : ''
        }`}
      >
        <button
          className={styles.toggleBtn}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <nav className={styles.nav}>
          {WIDGET_SECTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={styles.navItem} onClick={() => handleNavClick(item.id)}>
                <Icon size={16} />
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
