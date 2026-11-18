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

/* ------------------------------------------------------------------ *
 * Historical candles for the chart.
 * ------------------------------------------------------------------ */

export interface Candle {
  /** Epoch seconds, as the charting library expects. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleSeries {
  candles: Candle[];
  currency: string;
  exchange: string;
  name: string;
  /** IANA zone of the exchange, so intraday times can be shown in market time. */
  timezone: string;
  gmtOffsetSeconds: number;
}

const CANDLE_CACHE_TTL_MS = 60_000;
const candleCache = new Map<string, { at: number; series: CandleSeries }>();

/**
 * Yahoo rejects some interval/range pairs (1m only goes back a few days), so
 * the caller passes a pair that the provider accepts - see CHART_TIMEFRAMES.
 */
export async function fetchCandles(
  symbol: string,
  interval: string,
  range: string
): Promise<CandleSeries> {
  const key = `${symbol}|${interval}|${range}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < CANDLE_CACHE_TTL_MS) return hit.series;

  let lastError: unknown = null;

  for (const host of HOSTS) {
    try {
      const url =
        `${host}/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let json: any;
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
            Accept: 'application/json',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      } finally {
        clearTimeout(timer);
      }

      const result = json?.chart?.result?.[0];
      const meta = result?.meta;
      const stamps: number[] = result?.timestamp ?? [];
      const quote = result?.indicators?.quote?.[0];

      if (!meta || !quote || stamps.length === 0) {
        throw new Error('no candles in provider response');
      }

      const candles: Candle[] = [];
      for (let i = 0; i < stamps.length; i += 1) {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        // Gaps (holidays, halts) come back as nulls; drop those bars rather
        // than drawing a flat line through them.
        if ([open, high, low, close].some((v) => typeof v !== 'number' || !Number.isFinite(v))) continue;
        candles.push({
          time: stamps[i],
          open,
          high,
          low,
          close,
          volume: typeof quote.volume?.[i] === 'number' ? quote.volume[i] : 0,
        });
      }

      if (candles.length === 0) throw new Error('every candle in the range was empty');

      const series: CandleSeries = {
        candles,
        currency: meta.currency || 'INR',
        exchange: meta.fullExchangeName || meta.exchangeName || '',
        name: meta.shortName || meta.longName || symbol,
        timezone: meta.exchangeTimezoneName || 'Asia/Kolkata',
        gmtOffsetSeconds: typeof meta.gmtoffset === 'number' ? meta.gmtoffset : 19800,
      };

      candleCache.set(key, { at: Date.now(), series });
      return series;
    } catch (error) {
      lastError = error;
    }
  }

  const stale = candleCache.get(key);
  if (stale) return stale.series;

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Timeframes offered in the chart toolbar, with the provider pair each uses. */
export const CHART_TIMEFRAMES = {
  '1m': { interval: '1m', range: '1d', intraday: true },
  '5m': { interval: '5m', range: '5d', intraday: true },
  '15m': { interval: '15m', range: '1mo', intraday: true },
  '30m': { interval: '30m', range: '1mo', intraday: true },
  '1h': { interval: '60m', range: '3mo', intraday: true },
  '1D': { interval: '1d', range: '1y', intraday: false },
  '1W': { interval: '1wk', range: '5y', intraday: false },
  '1M': { interval: '1mo', range: 'max', intraday: false },
} as const;

export type ChartTimeframe = keyof typeof CHART_TIMEFRAMES;

export const PROVIDER_INFO = {
  name: 'Yahoo Finance (public chart API)',
  kind: 'delayed' as const,
  notes:
    'Free, unofficial, no API key. Indian exchange quotes are delayed (commonly up to ~15 minutes). Data age is shown per refresh.',
};
