import { useEffect, useState } from 'react';

const DEFAULT_WINDOW = 60;

function load(storageKey) {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey));
    if (s) return s;
  } catch {
    /* ignore */
  }
  return { startIndex: 0, endIndex: 0, isLive: true, windowSize: DEFAULT_WINDOW };
}

function save(storageKey, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// Ported from tv-recommendation-fullstack's useChartBrush.js — same
// live-follow-then-manual-scrub slider behavior for the Market Score
// history chart (docs/FRONTEND_LAYOUT_AND_STACK.md's "sleek, scrubbable
// range control" guidance).
//
// Live mode (default): as new data arrives, the window auto-slides to
// keep showing the most recent `windowSize` points. Once the user drags
// the brush away from the live (right) edge, live-follow turns off and
// the dragged window is remembered; dragging back to the end re-enables
// it.
export function useChartBrush(storageKey, chartData) {
  const [brushState, setBrushState] = useState(() => load(storageKey));

  useEffect(() => {
    if (!chartData || chartData.length === 0) return;
    const lastIdx = chartData.length - 1;

    setBrushState((prev) => {
      let next;
      if (prev.isLive) {
        const windowSize = Math.min(prev.windowSize || DEFAULT_WINDOW, chartData.length);
        next = {
          ...prev,
          startIndex: Math.max(0, lastIdx - windowSize + 1),
          endIndex: lastIdx,
        };
      } else {
        // Manual window: clamp to the new data length, re-open to the
        // remembered windowSize if it collapsed to zero width (Recharts
        // crash guard — same as the ported hook).
        let { startIndex, endIndex, windowSize } = prev;
        endIndex = Math.min(endIndex, lastIdx);
        startIndex = Math.min(startIndex, endIndex);
        if (endIndex - startIndex < 1) {
          startIndex = Math.max(0, endIndex - (windowSize || DEFAULT_WINDOW) + 1);
        }
        next = { ...prev, startIndex, endIndex };
      }
      // Bail out on no-op updates — otherwise a state write on every effect
      // run (even with unchanged indices) can loop against Recharts' own
      // Brush recompute, especially at small chart widths where it can
      // re-fire onChange on every render (see handleBrushChange below).
      if (next.startIndex === prev.startIndex && next.endIndex === prev.endIndex && next.isLive === prev.isLive) {
        return prev;
      }
      save(storageKey, next);
      return next;
    });
  }, [chartData, storageKey]);

  function handleBrushChange(range) {
    if (!range || range.startIndex == null || range.endIndex == null) return;
    const lastIdx = (chartData?.length ?? 1) - 1;
    const isAtEnd = range.endIndex >= lastIdx;
    setBrushState((prev) => {
      // Recharts' Brush can call onChange with the same indices on every
      // render at small widths — without this guard, that becomes an
      // infinite render loop (real bug hit while building the compact
      // header chart, see the useMemo note in HeaderMarketChart.jsx).
      if (prev.startIndex === range.startIndex && prev.endIndex === range.endIndex && prev.isLive === isAtEnd) {
        return prev;
      }
      const next = {
        startIndex: range.startIndex,
        endIndex: range.endIndex,
        isLive: isAtEnd,
        windowSize: range.endIndex - range.startIndex + 1,
      };
      save(storageKey, next);
      return next;
    });
  }

  return { brushRange: brushState, handleBrushChange };
}
