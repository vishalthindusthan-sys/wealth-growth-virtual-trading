/**
 * Yahoo Finance market-data provider (free, unofficial, delayed).
 *
 * Uses the public chart endpoint, which returns a `meta` block with the last
 * traded price, previous close, day high/low and volume. No API key is needed.
 * Prices for Indian exchanges are delayed (typically up to ~15 minutes) — the
 * UI shows the data age reported by the provider so nothing is presented as
 * real-time when it is not.
 *
 * All calls happen server-side (Next.js route handler) because the endpoint
 * does not send CORS headers.
 */

export interface ProviderQuote {
  providerSymbol: string;
  name: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string;
  exchange: string;
  /** Epoch ms of the last trade reported by the provider. */
  quoteTime: number | null;
}

interface CacheEntry {
  quote: ProviderQuote;
  fetchedAt: number;
}

const CACHE_TTL_MS = 20_000; // below the 30s dashboard refresh, so a refresh is always fresh
const REQUEST_TIMEOUT_MS = 7_000;
const CONCURRENCY = 8;
const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

const cache = new Map<string, CacheEntry>();

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function requestChart(host: string, symbol: string): Promise<any> {
  const url =
    `${host}/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=2d&includePrePost=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        // Yahoo rejects requests without a browser-like agent.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOne(symbol: string): Promise<ProviderQuote> {
  let lastError: unknown = null;

  for (const host of HOSTS) {
    try {
      const json = await requestChart(host, symbol);
      const result = json?.chart?.result?.[0];
      const meta = result?.meta;
      const price = num(meta?.regularMarketPrice);

      if (!meta || price === null) {
        throw new Error('no price in provider response');
      }

      const previousClose = num(meta.chartPreviousClose) ?? num(meta.previousClose);
      const change = previousClose !== null ? price - previousClose : num(meta.fulldayChange);
      const changePercent =
        previousClose !== null && previousClose !== 0
          ? ((price - previousClose) / previousClose) * 100
          : num(meta.regularMarketChangePercent);

      return {
        providerSymbol: symbol,
        name: meta.shortName || meta.longName || symbol,
        price,
        previousClose,
        change,
        changePercent,
        dayHigh: num(meta.regularMarketDayHigh),
        dayLow: num(meta.regularMarketDayLow),
        volume: num(meta.regularMarketVolume),
        currency: meta.currency || 'INR',
        exchange: meta.fullExchangeName || meta.exchangeName || '',
        quoteTime: num(meta.regularMarketTime) !== null ? meta.regularMarketTime * 1000 : null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface QuoteBatch {
  quotes: Map<string, ProviderQuote>;
  /** Symbols the provider could not serve, with the reason. */
  failures: { symbol: string; reason: string }[];
  /** Symbols served from the short-lived in-process cache. */
  cached: number;
}

/**
 * Fetch many symbols, in parallel but rate-limited, reusing cached quotes that
 * are younger than CACHE_TTL_MS. Individual failures never fail the batch: the
 * caller reports partial data instead of showing nothing.
 */
export async function fetchQuotes(symbols: string[]): Promise<QuoteBatch> {
  const quotes = new Map<string, ProviderQuote>();
  const failures: { symbol: string; reason: string }[] = [];
  const now = Date.now();
  const pending: string[] = [];
  let cached = 0;

  for (const symbol of symbols) {
    const hit = cache.get(symbol);
    if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
      quotes.set(symbol, hit.quote);
      cached += 1;
    } else {
      pending.push(symbol);
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const symbol = pending[cursor++];
      try {
        const quote = await fetchOne(symbol);
        cache.set(symbol, { quote, fetchedAt: Date.now() });
        quotes.set(symbol, quote);
      } catch (error) {
        const stale = cache.get(symbol);
        if (stale) {
          // Fallback: serve the last good quote rather than dropping the row.
          quotes.set(symbol, stale.quote);
        }
        failures.push({
          symbol,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker())
  );

  return { quotes, failures, cached };
}

/** Cache diagnostics for the admin panel. */
export function getCacheStats() {
  const now = Date.now();
  const entries = Array.from(cache.values());
  return {
    size: cache.size,
    ttlSeconds: CACHE_TTL_MS / 1000,
    freshEntries: entries.filter((e) => now - e.fetchedAt < CACHE_TTL_MS).length,
    oldestEntryAgeSeconds: entries.length
      ? Math.round((now - Math.min(...entries.map((e) => e.fetchedAt))) / 1000)
      : null,
  };
}

/** Drop every cached quote so the next request goes to the provider. */
export function clearQuoteCache() {
  const cleared = cache.size;
  cache.clear();
  return cleared;
}

export const PROVIDER_INFO = {
  name: 'Yahoo Finance (public chart API)',
  kind: 'delayed' as const,
  notes:
    'Free, unofficial, no API key. Indian exchange quotes are delayed (commonly up to ~15 minutes). Data age is shown per refresh.',
};
