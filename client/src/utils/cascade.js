// Client-side port of server/services/indicators/cascade.js's checkCascade
// — same algorithm, so a user-selected timeframe series can be recomputed
// from the full per-coin ema200 stack the API already returns, without a
// backend round-trip or a second source of truth for the math itself.
//
// emas: { m1, m5, m15, m30, h1, h4 } EMA200 values for one coin.
// seriesTfs: ordered longest -> shortest.
// threshold: % gap within which two adjacent levels are treated as equal.
export function checkCascade(emas, seriesTfs, threshold = 0.2) {
  if (!emas || !seriesTfs || seriesTfs.length < 2) return 'neutral';
  let isBull = true;
  let isBear = true;

  for (let i = 0; i < seriesTfs.length - 1; i++) {
    const emaLonger = emas[seriesTfs[i]];
    const emaShorter = emas[seriesTfs[i + 1]];
    if (emaLonger == null || emaShorter == null) return 'neutral';

    const pctDiff = ((emaShorter - emaLonger) / emaLonger) * 100;
    if (pctDiff < -threshold) isBull = false;
    if (pctDiff > threshold) isBear = false;
  }

  if (isBull && !isBear) return 'bull';
  if (isBear && !isBull) return 'bear';
  return 'neutral';
}

export const AVAILABLE_TFS = ['m1', 'm5', 'm15', 'm30', 'h1', 'h4'];

export const STRUCTURAL_SERIES_PRESETS = {
  'h4-h1-m15': { label: 'H4 → H1 → M15 (default)', tfs: ['h4', 'h1', 'm15'] },
  'h4-h1-m30': { label: 'H4 → H1 → M30', tfs: ['h4', 'h1', 'm30'] },
  'h1-m30-m15': { label: 'H1 → M30 → M15', tfs: ['h1', 'm30', 'm15'] },
  'h1-m15': { label: 'H1 → M15', tfs: ['h1', 'm15'] },
};

export const REACTIVE_SERIES_PRESETS = {
  'm5-m1': { label: 'M5 → M1 (default)', tfs: ['m5', 'm1'] },
  'm15-m5': { label: 'M15 → M5', tfs: ['m15', 'm5'] },
  'm30-m5': { label: 'M30 → M5', tfs: ['m30', 'm5'] },
};
