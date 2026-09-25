import { useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';
import { usePoll } from '../../../hooks/usePoll';
import { useEmaCandleWall } from '../../../hooks/useEmaCandleWall';
import { formatPrice } from '../../../utils/formatPrice';
import { WidgetCard } from '../WidgetCard';
import { StateBadge } from '../shared/StateBadge';
import { RsiZoneBar } from '../shared/RsiZoneBar';
import styles from './RsiGridWall.module.css';

// Widget Persistence Pattern (docs/FRONTEND_LAYOUT_AND_STACK.md): each
// settings-bearing widget owns its own <id>_prefs localStorage key and
// its own reset button — never a global reset.
const LS_KEY = 'rsiGridWall_prefs';
const DEFAULTS = { oversold: 30, overbought: 70 };

function loadPrefs() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

const CASCADE_META = {
  BULL_CASCADE: { variant: 'green', label: 'BULL CASCADE', Icon: TrendingUp },
  PARTIAL_BULL: { variant: 'green', label: 'PARTIAL BULL', Icon: TrendingUp },
  BEAR_CASCADE: { variant: 'red', label: 'BEAR CASCADE', Icon: TrendingDown },
  PARTIAL_BEAR: { variant: 'red', label: 'PARTIAL BEAR', Icon: TrendingDown },
  NEUTRAL: { variant: 'gray', label: 'NEUTRAL', Icon: Minus },
};

const DIR_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus };

const columnHelper = createColumnHelper();

export function RsiGridWall() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [sorting, setSorting] = useState([{ id: 'cascadeState', desc: false }]);
  const qs = new URLSearchParams({ oversold: prefs.oversold, overbought: prefs.overbought }).toString();
  const { data, lastUpdatedTs } = usePoll(`/api/rsi-grid-wall?${qs}`);
  const tempTf = data?.config?.tempTf || 'm15';
  // /api/rsi-grid-wall carries no price — joined from the same indicator
  // snapshot EMA Candle Wall polls, by base. Real field, not invented.
  const { data: candleData } = useEmaCandleWall();
  const priceByBase = new Map((candleData?.coins || []).map((c) => [c.base, c.price]));

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  function resetPrefs() {
    localStorage.removeItem(LS_KEY);
    setPrefs({ ...DEFAULTS });
  }

  const columns = [
    columnHelper.accessor('base', { header: 'Base', cell: (info) => <strong>{info.getValue()}</strong> }),
    columnHelper.accessor((row) => priceByBase.get(row.base), {
      id: 'price',
      header: 'Price',
      cell: (info) => {
        const v = info.getValue();
        return <span className="tabular-nums">{v != null ? `$${formatPrice(v)}` : '--'}</span>;
      },
    }),
    columnHelper.accessor('cascadeState', {
      header: 'Cascade',
      cell: (info) => {
        const meta = CASCADE_META[info.getValue()] || CASCADE_META.NEUTRAL;
        const Icon = meta.Icon;
        return (
          <StateBadge variant={meta.variant}>
            <Icon size={11} /> {meta.label}
          </StateBadge>
        );
      },
    }),
    columnHelper.accessor((row) => row.rsi?.[tempTf], {
      id: 'tempRsi',
      header: `${tempTf.toUpperCase()} RSI`,
      cell: (info) => {
        const row = info.row.original;
        const v = info.getValue();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
            <div style={{ flex: 1 }}>
              <RsiZoneBar value={v} oversold={prefs.oversold} overbought={prefs.overbought} pullback={row.pullback} />
            </div>
            <span className="tabular-nums" style={{ fontSize: 12, width: 30, textAlign: 'right' }}>
              {v != null ? v.toFixed(0) : '--'}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor('tempDir', {
      header: 'Momentum',
      cell: (info) => {
        const Icon = DIR_ICON[info.getValue()] || Minus;
        const color =
          info.getValue() === 'up' ? 'var(--accent-green)' : info.getValue() === 'down' ? 'var(--accent-red)' : 'var(--text-muted)';
        return <Icon size={14} color={color} />;
      },
    }),
    columnHelper.accessor((row) => (row.pullback ? 'Pullback' : ''), {
      id: 'pullback',
      header: 'Signal',
      cell: (info) => (info.getValue() ? <StateBadge variant="amber">PULLBACK</StateBadge> : null),
    }),
  ];

  const table = useReactTable({
    data: data?.coins || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <WidgetCard
      id="rsi-grid-wall"
      title="RSI Grid Wall"
      subtitle={`RSI(14) per coin on ${tempTf.toUpperCase()}. Bar shading = oversold/overbought zone; marker = current value. Not a candle — no OHLC here.`}
      lastUpdatedTs={lastUpdatedTs}
    >
      <div className={styles.controls}>
        <label>
          Oversold{' '}
          <input
            type="number"
            value={prefs.oversold}
            onChange={(e) => updatePref('oversold', Number(e.target.value))}
          />
        </label>
        <label>
          Overbought{' '}
          <input
            type="number"
            value={prefs.overbought}
            onChange={(e) => updatePref('overbought', Number(e.target.value))}
          />
        </label>
        <button className={styles.resetBtn} onClick={resetPrefs}>
          Reset
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} onClick={h.column.getToggleSortingHandler()}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted()] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={row.original.pullback ? styles.rowPullback : undefined}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </WidgetCard>
  );
}
