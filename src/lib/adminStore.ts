/**
 * Runtime state the admin panel reads and writes: platform settings, the last
 * market-data snapshot summary, and an audit log of admin actions.
 *
 * In-process only, so it resets when the server restarts and is per-instance on
 * a serverless host. That is deliberate for now - persisting it belongs in
 * Supabase, which this deployment does not have configured yet. Every surface
 * that shows this data says where it comes from.
 */

export interface PlatformSettings {
  /** Seconds between automatic refreshes on the live dashboard. */
  refreshIntervalSeconds: number;
  /** Simulated brokerage, as a fraction of order value. */
  brokerageRate: number;
  /** Whether the market-data feed is allowed to serve the dashboard. */
  marketDataEnabled: boolean;
}

export interface FeedSnapshotSummary {
  at: string;
  status: 'ok' | 'degraded' | 'error';
  served: number;
  requested: number;
  failed: number;
  failures: { symbol: string; reason: string }[];
  latencyMs: number;
  feedAgeSeconds: number | null;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  refreshIntervalSeconds: 30,
  brokerageRate: 0.001,
  marketDataEnabled: true,
};

interface Store {
  settings: PlatformSettings;
  lastSnapshot: FeedSnapshotSummary | null;
  snapshotCount: number;
  failedRequestCount: number;
  audit: AuditEntry[];
  startedAt: string;
}

// Survives hot reloads in dev, which otherwise re-evaluate the module.
const globalStore = globalThis as unknown as { __wgAdminStore?: Store };

const store: Store =
  globalStore.__wgAdminStore ??
  (globalStore.__wgAdminStore = {
    settings: { ...DEFAULT_SETTINGS },
    lastSnapshot: null,
    snapshotCount: 0,
    failedRequestCount: 0,
    audit: [],
    startedAt: new Date().toISOString(),
  });

export function getSettings(): PlatformSettings {
  return { ...store.settings };
}

export function updateSettings(patch: Partial<PlatformSettings>): PlatformSettings {
  if (typeof patch.refreshIntervalSeconds === 'number') {
    // Keep the provider inside polite limits: 10s floor, 10min ceiling.
    store.settings.refreshIntervalSeconds = Math.min(
      600,
      Math.max(10, Math.round(patch.refreshIntervalSeconds))
    );
  }
  if (typeof patch.brokerageRate === 'number' && patch.brokerageRate >= 0 && patch.brokerageRate <= 0.05) {
    store.settings.brokerageRate = patch.brokerageRate;
  }
  if (typeof patch.marketDataEnabled === 'boolean') {
    store.settings.marketDataEnabled = patch.marketDataEnabled;
  }
  return getSettings();
}

export function recordSnapshot(summary: FeedSnapshotSummary) {
  store.lastSnapshot = summary;
  store.snapshotCount += 1;
  store.failedRequestCount += summary.failed;
}

export function getFeedState() {
  return {
    lastSnapshot: store.lastSnapshot,
    snapshotCount: store.snapshotCount,
    failedRequestCount: store.failedRequestCount,
    serverStartedAt: store.startedAt,
  };
}

export function addAudit(actor: string, action: string, detail: string) {
  store.audit.unshift({ at: new Date().toISOString(), actor, action, detail });
  store.audit = store.audit.slice(0, 100);
}

export function getAudit(limit = 25): AuditEntry[] {
  return store.audit.slice(0, limit);
}
