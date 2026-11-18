'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

interface MarketRow {
  symbol: string;
  label: string;
  exchange: string;
  segment: 'INDEX' | 'EQUITY' | 'COMMODITY' | 'CURRENCY';
  currency: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  ageSeconds: number | null;
}

const TABS = [
  { key: 'NSE', label: 'NSE', match: (row: MarketRow) => row.exchange === 'NSE' },
  { key: 'BSE', label: 'BSE', match: (row: MarketRow) => row.exchange === 'BSE' },
  { key: 'COMMODITY', label: 'Commodity', match: (row: MarketRow) => row.segment === 'COMMODITY' },
  { key: 'CURRENCY', label: 'Currency', match: (row: MarketRow) => row.segment === 'CURRENCY' },
] as const;

function fmtPrice(value: number, currency: string) {
  const prefix = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  return `${prefix}${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2,
  })}`;
}

function fmtVolume(value: number | null) {
  if (!value) return '—';
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} K`;
  return String(value);
}

/**
 * Prices come from the live market feed, not from the database: nothing writes
 * quotes into Supabase yet (that needs the service-role key), so reading the
 * instruments table here would show a table of empty prices.
 */
export default function Markets() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('NSE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/market-data/live', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

      setRows([...json.indices, ...json.equities, ...json.commodities, ...json.currencies]);
      setUpdatedAt(json.asOf);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => {
    const matcher = TABS.find((t) => t.key === tab)?.match;
    const list = matcher ? rows.filter(matcher) : rows;
    return [...list].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  }, [rows, tab]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">Markets</h1>
            <p className="text-xs text-gray-500">
              Delayed prices from the live feed
              {updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString('en-IN')}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-lg px-4 py-2 font-semibold transition ${
                  tab === item.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900 text-sm">
                  <th className="px-4 py-4 text-left text-gray-300">Symbol</th>
                  <th className="px-4 py-4 text-left text-gray-300">Name</th>
                  <th className="px-4 py-4 text-right text-gray-300">Price</th>
                  <th className="px-4 py-4 text-right text-gray-300">Change %</th>
                  <th className="px-4 py-4 text-right text-gray-300">Volume</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const up = (row.changePercent ?? 0) >= 0;
                  return (
                    <tr
                      key={`${row.segment}-${row.symbol}`}
                      className="border-b border-gray-700 transition hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-4 font-semibold text-white">{row.symbol}</td>
                      <td className="px-4 py-4 text-gray-300">{row.label}</td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-white">
                        {fmtPrice(row.price, row.currency)}
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-semibold tabular-nums ${
                          up ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {(row.changePercent ?? 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-300">{fmtVolume(row.volume)}</td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      {loading ? 'Loading instruments…' : 'No instruments in this segment.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
