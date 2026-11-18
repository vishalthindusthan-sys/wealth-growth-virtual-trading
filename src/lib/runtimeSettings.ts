/**
 * Runtime state for the market-data feed: platform settings and a summary of
 * the last snapshot.
 *
 * In-process only, so it resets when the server restarts and is per-instance on
 * a serverless host.
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
