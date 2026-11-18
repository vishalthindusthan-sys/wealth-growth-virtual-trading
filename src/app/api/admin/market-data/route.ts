import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, readSession } from '@/lib/adminAuth';
import { addAudit, getSettings, updateSettings } from '@/lib/adminStore';
import { clearQuoteCache } from '@/lib/providers/yahoo';

/**
 * Market-data controls for the admin panel:
 *   refresh-cache      drop cached quotes so the next poll hits the provider
 *   set-interval       change the dashboard auto-refresh interval (10-600s)
 *   toggle-feed        enable or disable the feed
 *   set-brokerage      change the simulated brokerage rate
 */
export async function POST(request: NextRequest) {
  const session = await readSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const action = String(body.action ?? '');

  switch (action) {
    case 'refresh-cache': {
      const cleared = clearQuoteCache();
      addAudit(session.email, 'marketdata.refresh', `Cleared ${cleared} cached quotes`);
      return NextResponse.json({ ok: true, cleared, settings: getSettings() });
    }

    case 'set-interval': {
      const seconds = Number(body.seconds);
      if (!Number.isFinite(seconds)) {
        return NextResponse.json({ error: 'seconds must be a number' }, { status: 400 });
      }
      const settings = updateSettings({ refreshIntervalSeconds: seconds });
      addAudit(
        session.email,
        'settings.refreshInterval',
        `Refresh interval set to ${settings.refreshIntervalSeconds}s`
      );
      return NextResponse.json({ ok: true, settings });
    }

    case 'toggle-feed': {
      const enabled = Boolean(body.enabled);
      const settings = updateSettings({ marketDataEnabled: enabled });
      addAudit(session.email, 'settings.feed', `Market data feed ${enabled ? 'enabled' : 'disabled'}`);
      return NextResponse.json({ ok: true, settings });
    }

    case 'set-brokerage': {
      const rate = Number(body.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 0.05) {
        return NextResponse.json({ error: 'rate must be between 0 and 0.05' }, { status: 400 });
      }
      const settings = updateSettings({ brokerageRate: rate });
      addAudit(
        session.email,
        'settings.brokerage',
        `Simulated brokerage set to ${(settings.brokerageRate * 100).toFixed(3)}%`
      );
      return NextResponse.json({ ok: true, settings });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action || '(none)'}` }, { status: 400 });
  }
}
