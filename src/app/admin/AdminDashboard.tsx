'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  LogOut,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface CountResult {
  value: number | null;
  error: string | null;
}

interface AdminStats {
  admin: { id: string; email: string; name: string; role: string };
  sessionExpiresAt: string;
  settings: { refreshIntervalSeconds: number; brokerageRate: number; marketDataEnabled: boolean };
  marketStatus: { label: string; istTime: string; istDate: string; nextChange: string | null; caveat: string };
  provider: {
    name: string;
    kind: string;
    notes: string;
    cache: { size: number; ttlSeconds: number; freshEntries: number; oldestEntryAgeSeconds: number | null };
  };
  feed: {
    lastSnapshot: {
      at: string;
      status: 'ok' | 'degraded' | 'error';
      served: number;
      requested: number;
      failed: number;
      failures: { symbol: string; reason: string }[];
      latencyMs: number;
      feedAgeSeconds: number | null;
    } | null;
    snapshotCount: number;
    failedRequestCount: number;
    serverStartedAt: string;
  };
  universe: { total: number; indices: number; equities: number; commodities: number; currencies: number };
  database: {
    configured: boolean;
    reason: string | null;
    tables: {
      users: CountResult;
      activeUsers: CountResult;
      orders: CountResult;
      recentOrders: CountResult;
      positions: CountResult;
      instruments: CountResult;
    } | null;
  };
  audit: { at: string; actor: string; action: string; detail: string }[];
  runtime: { env: string; serverStartedAt: string; note: string };
}

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'bad'
          ? 'text-red-400'
          : 'text-white';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function countText(result: CountResult | undefined) {
  if (!result) return '—';
  if (result.error) return 'n/a';
  return result.value === null ? '—' : result.value.toLocaleString('en-IN');
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intervalInput, setIntervalInput] = useState('30');
  const [brokerageInput, setBrokerageInput] = useState('0.100');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setStats(json as AdminStats);
      setIntervalInput(String(json.settings.refreshIntervalSeconds));
      setBrokerageInput((json.settings.brokerageRate * 100).toFixed(3));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin stats');
    }
  }, [router]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function act(payload: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch('/api/admin/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setToast(successMessage);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  const snapshot = stats?.feed.lastSnapshot ?? null;
  const feedTone =
    snapshot?.status === 'ok' ? 'good' : snapshot?.status === 'degraded' ? 'warn' : snapshot ? 'bad' : 'neutral';

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-400" />
            <span className="text-lg font-bold text-white">Admin panel</span>
            <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300">
              Wealth Growth Virtual Trading
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/live" className="rounded px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white">
              Live market
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Signed-in admin */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{stats?.admin.name ?? 'Administrator'}</p>
              <p className="text-xs text-gray-400">{stats?.admin.email ?? '—'}</p>
              <p className="mt-1 font-mono text-xs text-gray-500">
                user id: {stats?.admin.id ?? '—'}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Role: {stats?.admin.role ?? 'admin'}</p>
              <p>
                Session expires{' '}
                {stats ? new Date(stats.sessionExpiresAt).toLocaleString('en-IN') : '—'}
              </p>
              <p>Environment: {stats?.runtime.env ?? '—'}</p>
            </div>
          </div>
        </section>

        {/* Platform tiles */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Market feed"
            value={snapshot ? snapshot.status.toUpperCase() : 'NO DATA YET'}
            hint={
              snapshot
                ? `${snapshot.served}/${snapshot.requested} instruments · ${snapshot.latencyMs} ms`
                : 'Open the live dashboard to generate a snapshot'
            }
            icon={Activity}
            tone={feedTone}
          />
          <Tile
            label="Snapshots served"
            value={stats ? stats.feed.snapshotCount.toLocaleString('en-IN') : '—'}
            hint={`${stats?.feed.failedRequestCount ?? 0} failed provider requests since restart`}
            icon={Gauge}
          />
          <Tile
            label="Instruments tracked"
            value={stats ? String(stats.universe.total) : '—'}
            hint={
              stats
                ? `${stats.universe.indices} indices · ${stats.universe.equities} equities · ${stats.universe.commodities} commodities · ${stats.universe.currencies} FX`
                : undefined
            }
            icon={Database}
          />
          <Tile
            label="Registered users"
            value={stats?.database.configured ? countText(stats.database.tables?.users) : 'n/a'}
            hint={
              stats?.database.configured
                ? `${countText(stats.database.tables?.activeUsers)} active in 24h`
                : 'Supabase not configured'
            }
            icon={Users}
          />
        </section>

        {/* Market data management */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900">
            <h2 className="border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-200">
              Market data management
            </h2>
            <div className="space-y-4 p-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                <p>
                  Provider
                  <span className="mt-0.5 block text-sm text-white">{stats?.provider.name ?? '—'}</span>
                </p>
                <p>
                  Data kind
                  <span className="mt-0.5 block text-sm font-semibold text-amber-300">
                    {stats?.provider.kind?.toUpperCase() ?? '—'}
                  </span>
                </p>
                <p>
                  Last snapshot
                  <span className="mt-0.5 block text-sm text-white">
                    {snapshot ? new Date(snapshot.at).toLocaleTimeString('en-IN') : '—'}
                  </span>
                </p>
                <p>
                  Quote cache
                  <span className="mt-0.5 block text-sm text-white">
                    {stats ? `${stats.provider.cache.freshEntries}/${stats.provider.cache.size} fresh` : '—'}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3 border-t border-gray-800 pt-4">
                <label className="space-y-1">
                  <span className="block text-xs text-gray-400">Dashboard refresh (seconds)</span>
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={intervalInput}
                    onChange={(e) => setIntervalInput(e.target.value)}
                    className="w-32 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => act({ action: 'set-interval', seconds: Number(intervalInput) }, 'Refresh interval updated')}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  Apply
                </button>

                <label className="space-y-1">
                  <span className="block text-xs text-gray-400">Simulated brokerage (%)</span>
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    max={5}
                    value={brokerageInput}
                    onChange={(e) => setBrokerageInput(e.target.value)}
                    className="w-32 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => act({ action: 'set-brokerage', rate: Number(brokerageInput) / 100 }, 'Brokerage updated')}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  Apply
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-gray-800 pt-4">
                <button
                  disabled={busy}
                  onClick={() => act({ action: 'refresh-cache' }, 'Quote cache cleared')}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Force provider refresh
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      { action: 'toggle-feed', enabled: !(stats?.settings.marketDataEnabled ?? true) },
                      stats?.settings.marketDataEnabled ? 'Feed disabled' : 'Feed enabled'
                    )
                  }
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    stats?.settings.marketDataEnabled
                      ? 'border border-red-500/50 text-red-300 hover:bg-red-500/10'
                      : 'border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10'
                  } disabled:opacity-60`}
                >
                  {stats?.settings.marketDataEnabled ? 'Disable feed' : 'Enable feed'}
                </button>
                {toast && <span className="text-xs text-gray-400">{toast}</span>}
              </div>

              {snapshot && snapshot.failures.length > 0 && (
                <p className="border-t border-gray-800 pt-3 text-xs text-amber-300/80">
                  Last failures: {snapshot.failures.map((f) => `${f.symbol} (${f.reason})`).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* User / database management */}
          <div className="rounded-xl border border-gray-800 bg-gray-900">
            <h2 className="border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-200">
              Users and database
            </h2>
            <div className="p-4 text-sm">
              {stats?.database.configured ? (
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ['Registered users', stats.database.tables?.users],
                    ['Active (24h)', stats.database.tables?.activeUsers],
                    ['Total orders', stats.database.tables?.orders],
                    ['Orders (24h)', stats.database.tables?.recentOrders],
                    ['Open positions', stats.database.tables?.positions],
                    ['Instruments in DB', stats.database.tables?.instruments],
                  ].map(([label, result]) => (
                    <div key={String(label)} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                      <dt className="text-xs text-gray-500">{String(label)}</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-white">
                        {countText(result as CountResult)}
                      </dd>
                      {(result as CountResult)?.error && (
                        <p className="mt-1 text-[11px] text-amber-300/80">{(result as CountResult).error}</p>
                      )}
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-amber-200/90">
                  <p className="font-semibold">Supabase is not configured in this environment.</p>
                  <p className="text-xs">{stats?.database.reason}</p>
                  <p className="text-xs">
                    Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in
                    .env.local and run supabase_schema.sql. User listing, role changes and account activation need
                    those tables, so they are hidden rather than faked.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Audit log */}
        <section className="rounded-xl border border-gray-800 bg-gray-900">
          <h2 className="flex items-center gap-2 border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-200">
            <ScrollText className="h-4 w-4 text-gray-500" />
            Audit log
          </h2>
          <ul className="divide-y divide-gray-800">
            {(stats?.audit ?? []).map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs text-gray-500">
                  {new Date(entry.at).toLocaleTimeString('en-IN')}
                </span>
                <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-300">
                  {entry.action}
                </span>
                <span className="text-gray-300">{entry.detail}</span>
                <span className="ml-auto text-xs text-gray-600">{entry.actor}</span>
              </li>
            ))}
            {(stats?.audit.length ?? 0) === 0 && (
              <li className="px-4 py-6 text-sm text-gray-500">No admin actions recorded yet.</li>
            )}
          </ul>
        </section>

        <footer className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-500">
          <p>{stats?.runtime.note}</p>
          <p className="mt-1">{stats?.marketStatus.caveat}</p>
          <p className="mt-1">
            Admin credentials come from server environment variables, never from the user database, and the session
            cookie is HMAC-signed and httpOnly.
          </p>
        </footer>
      </main>
    </div>
  );
}
