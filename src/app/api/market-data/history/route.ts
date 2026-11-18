import { NextRequest, NextResponse } from 'next/server';
import { CHART_TIMEFRAMES, fetchCandles, type ChartTimeframe } from '@/lib/providers/yahoo';
import { ALL_INSTRUMENTS } from '@/lib/marketUniverse';

/**
 * OHLCV history for the chart.
 *
 * Only instruments in the tracked universe are accepted, so the symbol in the
 * query string can never be used to make the server fetch an arbitrary URL.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbol = params.get('symbol') ?? '';
  const timeframe = (params.get('timeframe') ?? '5m') as ChartTimeframe;

  const instrument = ALL_INSTRUMENTS.find((i) => i.symbol.toLowerCase() === symbol.toLowerCase());
  if (!instrument) {
    return NextResponse.json({ error: `Unknown instrument: ${symbol || '(none)'}` }, { status: 404 });
  }

  const preset = CHART_TIMEFRAMES[timeframe];
  if (!preset) {
    return NextResponse.json(
      { error: `Unknown timeframe. Use one of: ${Object.keys(CHART_TIMEFRAMES).join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const series = await fetchCandles(instrument.providerSymbol, preset.interval, preset.range);

    return NextResponse.json(
      {
        symbol: instrument.symbol,
        label: instrument.label,
        exchange: instrument.exchange,
        segment: instrument.segment,
        timeframe,
        interval: preset.interval,
        range: preset.range,
        intraday: preset.intraday,
        currency: series.currency,
        timezone: series.timezone,
        gmtOffsetSeconds: series.gmtOffsetSeconds,
        count: series.candles.length,
        candles: series.candles,
        note: instrument.note ?? null,
        asOf: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Could not load chart history',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    );
  }
}
