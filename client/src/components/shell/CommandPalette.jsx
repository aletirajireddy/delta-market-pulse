import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { WIDGET_SECTIONS } from '../../config/widgetSections';
import { scrollToSection } from '../../utils/scrollToSection';
import { usePoll } from '../../hooks/usePoll';
import styles from './CommandPalette.module.css';

// cmdk command palette, Cmd/Ctrl+K — jump to any widget section or symbol.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { data: watchlist } = usePoll(open ? '/api/watchlist' : null, 30000);

  useEffect(() => {
    function onKeyDown(e) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  async function jumpToSection(id) {
    setOpen(false);
    await scrollToSection(id);
  }

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <Command label="Command palette">
          <Command.Input autoFocus placeholder="Jump to a widget or symbol..." className={styles.input} />
          <Command.List className={styles.list}>
            <Command.Empty className={styles.empty}>No results</Command.Empty>
            <Command.Group heading="Widgets">
              {WIDGET_SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <Command.Item key={s.id} className={styles.item} onSelect={() => jumpToSection(s.id)}>
                    <Icon size={15} />
                    {s.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
            {watchlist?.coins?.length > 0 && (
              <Command.Group heading="Symbols">
                {watchlist.coins.map((c) => (
                  <Command.Item key={c.base} className={styles.item} onSelect={() => jumpToSection('watchlist')}>
                    {c.base}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
