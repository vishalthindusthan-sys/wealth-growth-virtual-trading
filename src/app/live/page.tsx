'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import PriceChart from '@/components/PriceChart';
import {
  Activity,
  AlertTriangle,
  Search,
  X,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

type Segment = 'INDEX' | 'EQUITY' | 'COMMODITY' | 'CURRENCY';

interface LiveRow {
  symbol: string;
  label: string;
  exchange: string;
  segment: Segment;
  currency: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  quoteTime: string | null;
  ageSeconds: number | null;
  note?: string;
}

interface Snapshot {
  asOf: string;
  latencyMs: number;
  status: 'ok' | 'degraded' | 'error';
  provider: {
    name: string;
    kind: string;
    notes: string;
    servedFromCache: number;
    requested: number;
    served: number;
    failed: number;
    failures: { symbol: string; reason: string }[];
    feedAgeSeconds: number | null;
  };
  marketStatus: {
    state: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'WEEKEND';
    label: string;
    istTime: string;
    istDate: string;
    nextChange: string | null;
    caveat: string;
  };
  refreshIntervalSeconds: number;
  disclaimer: string;
  breadth: { advances: number; declines: number; unchanged: number };
  indices: LiveRow[];
  equities: LiveRow[];
  gainers: LiveRow[];
  losers: LiveRow[];
  mostActive: LiveRow[];
  commodities: LiveRow[];
  currencies: LiveRow[];
}

// Fallback only: the live interval comes from the admin panel setting that the
// API reports with every snapshot.
const DEFAULT_REFRESH_SECONDS = 30;

function fmtPrice(value: number, currency: string) {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  const digits = Math.abs(value) < 10 ? 4 : 2;
  return `${symbol}${value.toLocaleString('en-IN', {
    minimumFractionDigits: digits === 4 ? 2 : 2,
    maximumFractionDigits: digits,
  })}`;
}

function fmtSigned(value: number | null, digits = 2) {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function fmtVolume(value: number | null) {
  if (value === null || value === 0) return '—';
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} K`;
  return String(value);
}

function fmtAge(seconds: number | null) {
  if (seconds === null) return 'unknown';
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function toneFor(value: number | null) {
  if (value === null || value === 0) return 'text-gray-300';
  return value > 0 ? 'text-emerald-400' : 'text-red-400';
}

function ChangeBadge({ change, percent }: { change: number | null; percent: number | null }) {
  const positive = (percent ?? 0) > 0;
  const flat = percent === null || percent === 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
        flat
          ? 'bg-gray-700/40 text-gray-300'
          : positive
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
      }`}
    >
      {!flat && <Icon className="h-3.5 w-3.5" />}
      {fmtSigned(change)} ({fmtSigned(percent)}%)
    </span>
  );
}

function StatusPill({ snapshot, online }: { snapshot: Snapshot | null; online: boolean }) {
  if (!online) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-300">
        <WifiOff className="h-4 w-4" /> Feed unreachable
      </span>
    );
  }
  if (!snapshot) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-gray-700/50 px-3 py-1 text-sm text-gray-300">
        <RefreshCw className="h-4 w-4 animate-spin" /> Connecting
      </span>
    );
  }
  const degraded = snapshot.status === 'degraded';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
        degraded ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
      }`}
    >
      {degraded ? <AlertTriangle className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
      {degraded
        ? `Partial feed · ${snapshot.provider.served}/${snapshot.provider.requested} instruments`
        : `Feed connected · ${snapshot.provider.served} instruments`}
    </span>
  );
}

function MarketStatePill({ snapshot }: { snapshot: Snapshot | null }) {
  const state = snapshot?.marketStatus;
  if (!state) return null;
  const open = state.state === 'OPEN';
  const preOpen = state.state === 'PRE_OPEN';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
        open
          ? 'bg-emerald-500/10 text-emerald-300'
          : preOpen
            ? 'bg-blue-500/10 text-blue-300'
            : 'bg-gray-700/50 text-gray-300'
      }`}
      title={state.caveat}
    >
      <Activity className="h-4 w-4" />
      NSE / BSE {state.label}
      {state.nextChange ? <span className="text-gray-400">· {state.nextChange}</span> : null}
    </span>
  );
}

function IndexCard({
  row,
  flash,
  onSelect,
}: {
  row: LiveRow;
  flash?: 'up' | 'down' | null;
  onSelect?: (row: LiveRow) => void;
}) {
  const positive = (row.changePercent ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(row)}
      title={`Open the ${row.symbol} chart`}
      className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors duration-500 hover:border-blue-500/60 ${
        flash === 'up'
          ? 'border-emerald-500/60 bg-emerald-500/5'
          : flash === 'down'
            ? 'border-red-500/60 bg-red-500/5'
            : 'border-gray-800 bg-gray-900'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-medium text-gray-300">{row.label}</p>
        <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
          {row.exchange}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
        {row.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${toneFor(row.changePercent)}`}>
        {fmtSigned(row.change)} ({fmtSigned(row.changePercent)}%)
      </p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
        <span>
          L {row.dayLow !== null ? row.dayLow.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
        </span>
        <div className="mx-2 h-1 flex-1 rounded-full bg-gray-800">
          {row.dayLow !== null && row.dayHigh !== null && row.dayHigh > row.dayLow && (
            <div
              className={`h-1 w-1.5 rounded-full ${positive ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{
                marginLeft: `${Math.min(
                  100,
                  Math.max(0, ((row.price - row.dayLow) / (row.dayHigh - row.dayLow)) * 100)
                )}%`,
              }}
            />
          )}
        </div>
        <span>
          H {row.dayHigh !== null ? row.dayHigh.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
        </span>
      </div>
    </button>
  );
}

function MoversCard({
  title,
  rows,
  metric,
  onSelect,
}: {
  title: string;
  rows: LiveRow[];
  metric: 'percent' | 'volume';
  onSelect?: (row: LiveRow) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      <h3 className="border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-200">{title}</h3>
      <ul className="divide-y divide-gray-800">
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-gray-500">No data in this refresh.</li>}
        {rows.map((row) => (
          <li
            key={row.symbol}
            onClick={() => onSelect?.(row)}
            title={`Open the ${row.symbol} chart`}
            className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-800/60"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{row.symbol}</p>
              <p className="truncate text-xs text-gray-500">{row.label}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-white">{fmtPrice(row.price, row.currency)}</p>
              <p className={`text-xs font-semibold tabular-nums ${toneFor(row.changePercent)}`}>
                {metric === 'percent'
                  ? `${fmtSigned(row.changePercent)}%`
                  : `${fmtVolume(row.volume)} shares`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuoteTable({
  title,
  rows,
  note,
  flashes,
}: {
  title: string;
  rows: LiveRow[];
  note?: string;
  flashes?: Record<string, 'up' | 'down' | null>;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        {note && <p className="text-xs text-gray-500">{note}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5 text-left font-medium">Instrument</th>
              <th className="px-4 py-2.5 text-right font-medium">Last</th>
              <th className="px-4 py-2.5 text-right font-medium">Change</th>
              <th className="px-4 py-2.5 text-right font-medium">Change %</th>
              <th className="px-4 py-2.5 text-right font-medium">Day low</th>
              <th className="px-4 py-2.5 text-right font-medium">Day high</th>
              <th className="px-4 py-2.5 text-right font-medium">Prev close</th>
              <th className="px-4 py-2.5 text-right font-medium">Volume</th>
              <th className="px-4 py-2.5 text-right font-medium">Quote age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((row) => {
              const flash = flashes?.[row.symbol];
              return (
                <tr
                  key={`${row.segment}-${row.symbol}`}
                  className={`transition-colors duration-500 ${
                    flash === 'up' ? 'bg-emerald-500/5' : flash === 'down' ? 'bg-red-500/5' : 'hover:bg-gray-800/40'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-white">{row.symbol}</p>
                    <p className="text-xs text-gray-500">
                      {row.label} · {row.exchange}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-white">
                    {fmtPrice(row.price, row.currency)}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${toneFor(row.change)}`}>
                    {fmtSigned(row.change)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${toneFor(row.changePercent)}`}>
                    {fmtSigned(row.changePercent)}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                    {row.dayLow !== null ? fmtPrice(row.dayLow, row.currency) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                    {row.dayHigh !== null ? fmtPrice(row.dayHigh, row.currency) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">
                    {row.previousClose !== null ? fmtPrice(row.previousClose, row.currency) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-300">{fmtVolume(row.volume)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500">{fmtAge(row.ageSeconds)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                  No instruments returned in this refresh.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function segmentLabel(segment: Segment) {
  switch (segment) {
    case 'INDEX':
      return 'Index';
    case 'EQUITY':
      return 'Stock';
    case 'COMMODITY':
      return 'Commodity';
    case 'CURRENCY':
      return 'Currency';
    default:
      return segment;
  }
}

/**
 * Search every tracked instrument by symbol or company name. A match at the
 * start of the symbol or name ranks above a match in the middle, so typing
 * "ta" offers TATASTEEL before Hindustan Unilever.
 */
function searchInstruments(rows: LiveRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { row: LiveRow; score: number }[] = [];
  for (const row of rows) {
    const symbol = row.symbol.toLowerCase();
    const label = row.label.toLowerCase();
    let score = -1;
    if (symbol === q) score = 0;
    else if (symbol.startsWith(q)) score = 1;
    else if (label.startsWith(q)) score = 2;
    else if (symbol.includes(q)) score = 3;
    else if (label.includes(q)) score = 4;
    if (score >= 0) scored.push({ row, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.row.symbol.localeCompare(b.row.symbol))
    .slice(0, 10)
    .map((entry) => entry.row);
}

function StockSearch({
  rows,
  query,
  onQueryChange,
  onSelect,
}: {
  rows: LiveRow[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (row: LiveRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => searchInstruments(rows, query), [rows, query]);

  useEffect(() => setHighlight(0), [query]);

  // Close the suggestion list when a click lands outside the box.
  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function choose(row: LiveRow) {
    onSelect(row);
    onQueryChange(row.symbol);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      if (matches[highlight]) {
        event.preventDefault();
        choose(matches[highlight]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 focus-within:border-blue-500">
        <Search className="h-4 w-4 shrink-0 text-gray-500" />
        <input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search stock name or symbol - Reliance, TCS, NIFTY, Gold, USDINR"
          aria-label="Search instruments by name or symbol"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
        />
        {query && (
          <button
            onClick={() => {
              onQueryChange('');
              setOpen(false);
            }}
            aria-label="Clear search"
            className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim().length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-96 w-full overflow-auto rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
          {matches.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No tracked instrument matches that search.</li>
          )}
          {matches.map((row, index) => (
            <li key={`${row.segment}-${row.symbol}`}>
              <button
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(row)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                  index === highlight ? 'bg-gray-800' : 'hover:bg-gray-800/60'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{row.symbol}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {row.label} · {row.exchange} · {segmentLabel(row.segment)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-white">
                    {fmtPrice(row.price, row.currency)}
                  </span>
                  <span className={`block text-xs font-semibold tabular-nums ${toneFor(row.changePercent)}`}>
                    {fmtSigned(row.changePercent)}%
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InstrumentDetail({ row, onClose }: { row: LiveRow; onClose: () => void }) {
  return (
    <section className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">{row.symbol}</h2>
            <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
              {row.exchange}
            </span>
            <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
              {segmentLabel(row.segment)}
            </span>
          </div>
          <p className="text-sm text-gray-400">{row.label}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-white">{fmtPrice(row.price, row.currency)}</p>
          <ChangeBadge change={row.change} percent={row.changePercent} />
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          aria-label="Close instrument detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Day low', row.dayLow !== null ? fmtPrice(row.dayLow, row.currency) : '-'],
          ['Day high', row.dayHigh !== null ? fmtPrice(row.dayHigh, row.currency) : '-'],
          ['Prev close', row.previousClose !== null ? fmtPrice(row.previousClose, row.currency) : '-'],
          ['Volume', fmtVolume(row.volume)],
          ['Quote age', fmtAge(row.ageSeconds)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</dd>
          </div>
        ))}
      </dl>

      {row.note && <p className="mt-3 text-xs text-amber-300/80">{row.note}</p>}
    </section>
  );
}

export default function LiveDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshSeconds, setRefreshSeconds] = useState(DEFAULT_REFRESH_SECONDS);
  const [countdown, setCountdown] = useState(DEFAULT_REFRESH_SECONDS);
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [query, setQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const previousPrices = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market-data/live', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || `Market data request failed (HTTP ${res.status})`);
      }

      const rows: LiveRow[] = [
        ...json.indices,
        ...json.equities,
        ...json.commodities,
        ...json.currencies,
      ];

      const nextFlashes: Record<string, 'up' | 'down' | null> = {};
      for (const row of rows) {
        const before = previousPrices.current[row.symbol];
        if (before !== undefined && before !== row.price) {
          nextFlashes[row.symbol] = row.price > before ? 'up' : 'down';
        }
        previousPrices.current[row.symbol] = row.price;
      }

      const interval = Number(json.refreshIntervalSeconds) || DEFAULT_REFRESH_SECONDS;

      setSnapshot(json as Snapshot);
      setFlashes(nextFlashes);
      setError(null);
      setRefreshSeconds(interval);
      setCountdown(interval);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error while loading market data');
    } finally {
      setLoading(false);
    }
  }, []);

  // First load + auto refresh on the admin-configured interval (paused while
  // the tab is hidden).
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSeconds]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => (c <= 1 ? refreshSeconds : c - 1)), 1000);
    return () => clearInterval(tick);
  }, [refreshSeconds]);

  // Clear the price-change highlight shortly after a refresh.
  useEffect(() => {
    if (Object.keys(flashes).length === 0) return;
    const timer = setTimeout(() => setFlashes({}), 1600);
    return () => clearTimeout(timer);
  }, [flashes]);

  const allRows = useMemo(
    () =>
      snapshot
        ? [...snapshot.indices, ...snapshot.equities, ...snapshot.commodities, ...snapshot.currencies]
        : [],
    [snapshot]
  );

  const selectedRow = useMemo(
    () => (selectedSymbol ? (allRows.find((row) => row.symbol === selectedSymbol) ?? null) : null),
    [allRows, selectedSymbol]
  );

  // The equity table narrows to the search text, so a search both suggests and
  // filters rather than only jumping to one row.
  const filteredEquities = useMemo(() => {
    const base = snapshot?.equities ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (row) => row.symbol.toLowerCase().includes(q) || row.label.toLowerCase().includes(q)
    );
  }, [snapshot, query]);

  function downloadCsv() {
    if (!snapshot) return;
    const header = [
      'Segment',
      'Symbol',
      'Name',
      'Exchange',
      'Currency',
      'Last price',
      'Change',
      'Change %',
      'Day low',
      'Day high',
      'Previous close',
      'Volume',
      'Quote time (ISO)',
      'Snapshot time (ISO)',
    ];
    const lines = allRows.map((row) =>
      [
        row.segment,
        row.symbol,
        `"${row.label.replace(/"/g, '""')}"`,
        row.exchange,
        row.currency,
        row.price,
        row.change ?? '',
        row.changePercent ?? '',
        row.dayLow ?? '',
        row.dayHigh ?? '',
        row.previousClose ?? '',
        row.volume ?? '',
        row.quoteTime ?? '',
        snapshot.asOf,
      ].join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealth-growth-market-snapshot-${snapshot.asOf.slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const breadth = snapshot?.breadth;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-bold text-white">
              Wealth Growth
            </Link>
            <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300">
              Live market dashboard
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/markets" className="rounded px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white">
              Markets
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Status bar */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <MarketStatePill snapshot={snapshot} />
            <StatusPill snapshot={snapshot} online={!error} />
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-800/60 px-3 py-1 text-sm text-gray-300">
              <Clock className="h-4 w-4" />
              {snapshot ? `${snapshot.marketStatus.istTime} IST` : '--:--:-- IST'}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {loading ? 'Refreshing…' : `Next refresh in ${countdown}s`}
              </span>
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh now
              </button>
              <button
                onClick={downloadCsv}
                disabled={!snapshot}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Snapshot CSV
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span>
              Source: {snapshot?.provider.name ?? 'Yahoo Finance (public chart API)'} ·{' '}
              <span className="font-semibold text-amber-300">DELAYED data</span>
            </span>
            {snapshot && (
              <>
                <span>Newest quote {fmtAge(snapshot.provider.feedAgeSeconds)}</span>
                <span>Snapshot at {new Date(snapshot.asOf).toLocaleTimeString('en-IN')} ({snapshot.latencyMs} ms)</span>
                <span>
                  {snapshot.provider.served}/{snapshot.provider.requested} instruments
                  {snapshot.provider.failed > 0 ? ` · ${snapshot.provider.failed} failed` : ''}
                </span>
                {breadth && (
                  <span>
                    Breadth: <span className="text-emerald-400">{breadth.advances} up</span> /{' '}
                    <span className="text-red-400">{breadth.declines} down</span> / {breadth.unchanged} flat
                  </span>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Market data could not be refreshed.</p>
                <p className="text-red-200/80">{error}</p>
                <p className="text-red-200/60">
                  Showing the last successful snapshot, if any. The dashboard keeps retrying every{' '}
                  {refreshSeconds} seconds.
                </p>
              </div>
            </div>
          )}

          {snapshot && snapshot.provider.failures.length > 0 && (
            <p className="mt-2 text-xs text-amber-300/80">
              Unavailable this refresh: {snapshot.provider.failures.map((f) => f.symbol).join(', ')}
            </p>
          )}
        </section>

        {/* Stock search */}
        <section className="space-y-3">
          <StockSearch
            rows={allRows}
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              if (!value.trim()) setSelectedSymbol(null);
            }}
            onSelect={(row) => setSelectedSymbol(row.symbol)}
          />
          {selectedRow && (
            <>
              <InstrumentDetail
                row={selectedRow}
                onClose={() => {
                  setSelectedSymbol(null);
                  setQuery('');
                }}
              />
              <PriceChart symbol={selectedRow.symbol} label={selectedRow.label} />
            </>
          )}
          {!selectedRow && (
            <p className="text-xs text-gray-600">
              Search an instrument, or click any index card or mover below, to open its chart.
            </p>
          )}
        </section>

        {/* Indices */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Indices</h2>
          {!snapshot && loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {snapshot?.indices.map((row) => (
                <IndexCard
                  key={row.symbol}
                  row={row}
                  flash={flashes[row.symbol] ?? null}
                  onSelect={(picked) => {
                    setSelectedSymbol(picked.symbol);
                    setQuery('');
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Movers */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <MoversCard
            title="Top gainers"
            rows={snapshot?.gainers ?? []}
            metric="percent"
            onSelect={(picked) => setSelectedSymbol(picked.symbol)}
          />
          <MoversCard
            title="Top losers"
            rows={snapshot?.losers ?? []}
            metric="percent"
            onSelect={(picked) => setSelectedSymbol(picked.symbol)}
          />
          <MoversCard
            title="Most active by volume"
            rows={snapshot?.mostActive ?? []}
            metric="volume"
            onSelect={(picked) => setSelectedSymbol(picked.symbol)}
          />
        </section>

        {/* Equities */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">NSE equity watch</h2>
            {snapshot && (
              <p className="text-xs text-gray-500">
                {query.trim()
                  ? `${filteredEquities.length} of ${snapshot.equities.length} match the search`
                  : `${snapshot.equities.length} instruments`}{' '}
                · refreshed every {refreshSeconds}s
              </p>
            )}
          </div>
          <QuoteTable
            title={query.trim() ? `Cash market — filtered by “${query.trim()}”` : 'Cash market'}
            rows={filteredEquities}
            flashes={flashes}
          />
        </section>

        {/* Commodities + currencies */}
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <QuoteTable
            title="Commodities"
            rows={snapshot?.commodities ?? []}
            note="Global benchmark futures — MCX contracts are not on a free feed"
            flashes={flashes}
          />
          <QuoteTable title="Currency (INR pairs)" rows={snapshot?.currencies ?? []} flashes={flashes} />
        </section>

        <footer className="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-500">
          <p className="font-semibold text-gray-400">Data and usage notes</p>
          <p>
            {snapshot?.provider.notes ??
              'Free, unofficial feed. Indian exchange quotes are delayed (commonly up to ~15 minutes).'}
          </p>
          <p>{snapshot?.marketStatus.caveat}</p>
          <p className="text-amber-300/80">
            {snapshot?.disclaimer ??
              'Virtual trading only. No order placed on this platform ever reaches a broker or exchange.'}
          </p>
          <p>Nothing here is investment advice.</p>
        </footer>
      </main>
    </div>
  );
}
