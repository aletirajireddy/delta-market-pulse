import { List, Activity, Grid3x3, Flame } from 'lucide-react';

// Shared by Sidebar and CommandPalette so both nav surfaces stay in sync —
// add a widget here once and it appears in both places.
export const WIDGET_SECTIONS = [
  { id: 'watchlist', label: 'Watchlist', icon: List },
  { id: 'market-score', label: 'Market Score', icon: Activity },
  { id: 'rsi-grid-wall', label: 'RSI Grid Wall', icon: Grid3x3 },
  { id: 'ema-candle-wall', label: 'EMA Candle Wall', icon: Flame },
];
