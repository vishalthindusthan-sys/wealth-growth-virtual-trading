import { NextResponse } from 'next/server';
import { fetchQuotes, PROVIDER_INFO } from '@/lib/providers/yahoo';
import { getSettings, recordSnapshot } from '@/lib/runtimeSettings';
import {
  ALL_INSTRUMENTS,
  COMMODITIES,
  CURRENCIES,
  EQUITIES,
  INDICES,
  getMarketStatus,
  type Instrument,
} from '@/lib/marketUniverse';

// Note: this project runs Next.js with cacheComponents enabled, which rejects
// the `dynamic` / `revalidate` segment exports. Freshness is enforced instead by
// fetching the provider with `cache: 'no-store'` and returning `no-store` here.

export interface LiveRow {
  symbol: string;
  label: string;
  exchange: string;
  segment: Instrument['segment'];
  currency: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  quoteTime: string | null;
  /** Seconds between the provider quote time and this response. */
  ageSeconds: number | null;
  note?: string;
}

function toRow(instrument: Instrument, quote: NonNullable<ReturnType<Map<string, any>['get']>>): LiveRow {
  const quoteTime: number | null = quote.quoteTime ?? null;
  return {
    symbol: instrument.symbol,
    label: instrument.label,
    exchange: instrument.exchange,
    segment: instrument.segment,
    currency: quote.currency,
    price: quote.price,
    previousClose: quote.previousClose,
    change: quote.change,
    changePercent: quote.changePercent,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    volume: quote.volume,
    quoteTime: quoteTime ? new Date(quoteTime).toISOString() : null,
    ageSeconds: quoteTime ? Math.max(0, Math.round((Date.now() - quoteTime) / 1000)) : null,
    note: instrument.note,
  };
}

export async function GET() {
  const startedAt = Date.now();
  const settings = getSettings();

  if (!settings.marketDataEnabled) {
    // Switched off from the admin panel.
    return NextResponse.json(
      {
        status: 'error',
        asOf: new Date().toISOString(),
        message: 'Market data feed is disabled by an administrator.',
        marketStatus: getMarketStatus(),
        refreshIntervalSeconds: settings.refreshIntervalSeconds,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const { quotes, failures, cached } = await fetchQuotes(
      ALL_INSTRUMENTS.map((i) => i.providerSymbol)
    );

    const build = (list: Instrument[]) =>
      list
        .map((instrument) => {
          const quote = quotes.get(instrument.providerSymbol);
          return quote ? toRow(instrument, quote) : null;
        })
        .filter((row): row is LiveRow => row !== null);

    const indices = build(INDICES);
    const equities = build(EQUITIES);
    const commodities = build(COMMODITIES);
    const currencies = build(CURRENCIES);

    const ranked = [...equities].filter((r) => r.changePercent !== null);
    const gainers = [...ranked].sort((a, b) => b.changePercent! - a.changePercent!).slice(0, 8);
    const losers = [...ranked].sort((a, b) => a.changePercent! - b.changePercent!).slice(0, 8);
    const mostActive = [...equities]
      .filter((r) => r.volume !== null && r.volume > 0)
      .sort((a, b) => b.volume! - a.volume!)
      .slice(0, 8);

    const advances = ranked.filter((r) => r.changePercent! > 0).length;
    const declines = ranked.filter((r) => r.changePercent! < 0).length;

    const equityAges = equities.map((r) => r.ageSeconds).filter((a): a is number => a !== null);
    const feedAgeSeconds = equityAges.length ? Math.min(...equityAges) : null;

    const total = ALL_INSTRUMENTS.length;
    const served = indices.length + equities.length + commodities.length + currencies.length;
    const status: 'ok' | 'degraded' | 'error' =
      served === 0 ? 'error' : failures.length > 0 ? 'degraded' : 'ok';

    // Feed health the admin panel reads.
    recordSnapshot({
      at: new Date().toISOString(),
      status,
      served,
      requested: total,
      failed: failures.length,
      failures: failures.slice(0, 10),
      latencyMs: Date.now() - startedAt,
      feedAgeSeconds,
    });

    return NextResponse.json(
      {
        asOf: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        status,
        provider: {
          ...PROVIDER_INFO,
          servedFromCache: cached,
          requested: total,
          served,
          failed: failures.length,
          failures: failures.slice(0, 10),
          feedAgeSeconds,
        },
        marketStatus: getMarketStatus(),
        refreshIntervalSeconds: settings.refreshIntervalSeconds,
        disclaimer:
          'Virtual trading only. Prices are delayed, supplied by a free unofficial feed, and must not be used for real order placement. No order from this platform ever reaches a broker or exchange.',
        breadth: { advances, declines, unchanged: ranked.length - advances - declines },
        indices,
        equities,
        gainers,
        losers,
        mostActive,
        commodities,
        currencies,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        asOf: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown market-data error',
        marketStatus: getMarketStatus(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
