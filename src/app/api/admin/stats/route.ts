import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, readSession } from '@/lib/adminAuth';
import { getAudit, getFeedState, getSettings } from '@/lib/adminStore';
import { getCacheStats, PROVIDER_INFO } from '@/lib/providers/yahoo';
import {
  COMMODITIES,
  CURRENCIES,
  EQUITIES,
  INDICES,
  getMarketStatus,
} from '@/lib/marketUniverse';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Counts from Supabase when it is configured. Each count is reported
 * separately so one missing table does not blank the whole panel.
 */
async function databaseStats() {
  if (!isSupabaseConfigured) {
    return {
      configured: false as const,
      reason:
        'Supabase credentials are not set in this environment, so user, order and position counts are unavailable.',
      tables: null,
    };
  }

  async function count(table: string, since?: { column: string; value: string }) {
    try {
      const base = supabase.from(table).select('*', { count: 'exact', head: true });
      const query = since ? base.gte(since.column, since.value) : base;
      const { count: value, error } = await query;
      if (error) return { value: null, error: error.message };
      return { value: value ?? 0, error: null };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [users, activeUsers, orders, recentOrders, positions, instruments] = await Promise.all([
    count('users'),
    count('users', { column: 'last_login', value: since }),
    count('orders'),
    count('orders', { column: 'created_at', value: since }),
    count('positions'),
    count('instruments'),
  ]);

  return {
    configured: true as const,
    reason: null,
    tables: { users, activeUsers, orders, recentOrders, positions, instruments },
  };
}

export async function GET(request: NextRequest) {
  const session = await readSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feed = getFeedState();
  const database = await databaseStats();

  return NextResponse.json(
    {
      admin: { id: session.sub, email: session.email, name: session.name, role: session.role },
      sessionExpiresAt: new Date(session.exp * 1000).toISOString(),
      settings: getSettings(),
      marketStatus: getMarketStatus(),
      provider: {
        ...PROVIDER_INFO,
        cache: getCacheStats(),
      },
      feed,
      universe: {
        total: INDICES.length + EQUITIES.length + COMMODITIES.length + CURRENCIES.length,
        indices: INDICES.length,
        equities: EQUITIES.length,
        commodities: COMMODITIES.length,
        currencies: CURRENCIES.length,
      },
      database,
      audit: getAudit(25),
      runtime: {
        env: process.env.NODE_ENV ?? 'unknown',
        serverStartedAt: feed.serverStartedAt,
        note: 'Settings, feed counters and the audit log are held in memory and reset when the server restarts.',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
