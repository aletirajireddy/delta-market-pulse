import { useEffect, useRef } from 'react';
import { GlobalHeader } from './components/shell/GlobalHeader';
import { Sidebar } from './components/shell/Sidebar';
import { MobileFloatingBar } from './components/shell/MobileFloatingBar';
import { ScrollToTopBottom } from './components/shell/ScrollToTopBottom';
import { CommandPalette } from './components/shell/CommandPalette';
import { Watchlist } from './components/widgets/Watchlist/Watchlist';
import { MarketScore } from './components/widgets/MarketScore/MarketScore';
import { RsiGridWall } from './components/widgets/RsiGridWall/RsiGridWall';
import { EmaCandleWall } from './components/widgets/EmaCandleWall/EmaCandleWall';
import { useThemeStore } from './store/useThemeStore';
import styles from './App.module.css';

export default function App() {
  const mainContentRef = useRef(null);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <div className={styles.appContainer}>
      <header className={styles.topBar}>
        <GlobalHeader />
      </header>
      <div className={styles.viewLayout}>
        <Sidebar />
        <main className={styles.mainContent} ref={mainContentRef}>
          <Watchlist />
          <MarketScore />
          <RsiGridWall />
          <EmaCandleWall />
        </main>
      </div>
      <MobileFloatingBar />
      <ScrollToTopBottom scrollRef={mainContentRef} />
      <CommandPalette />
    </div>
  );
}
