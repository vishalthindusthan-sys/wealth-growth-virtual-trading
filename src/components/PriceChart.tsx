'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoryResponse {
  symbol: string;
  label: string;
  exchange: string;
  timeframe: string;
  interval: string;
  intraday: boolean;
  currency: string;
  gmtOffsetSeconds: number;
  count: number;
  candles: Candle[];
  note: string | null;
}

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const CHART_TYPES = ['Candles', 'Line', 'Area'] as const;
type ChartType = (typeof CHART_TYPES)[number];

const EMA_CONFIG = [
  { period: 9, color: '#f59e0b' },
  { period: 21, color: '#38bdf8' },
  { period: 50, color: '#a855f7' },
  { period: 200, color: '#f43f5e' },
] as const;

const UP = '#22c55e';
const DOWN = '#ef4444';

/* ------------------------------------------------------------------ *
 * Indicator maths
 * ------------------------------------------------------------------ */

function ema(values: number[], period: number) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Session-anchored VWAP: the running total restarts on each new trading day. */
function vwap(candles: Candle[], offsetSeconds: number) {
  const out: (number | null)[] = [];
  let day = '';
  let pv = 0;
  let vol = 0;

  for (const candle of candles) {
    const dayKey = new Date((candle.time + offsetSeconds) * 1000).toISOString().slice(0, 10);
    if (dayKey !== day) {
      day = dayKey;
      pv = 0;
      vol = 0;
    }
    const typical = (candle.high + candle.low + candle.close) / 3;
    pv += typical * (candle.volume || 0);
    vol += candle.volume || 0;
    out.push(vol > 0 ? pv / vol : null);
  }
  return out;
}

function rsi(values: number[], period = 14) {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Chart
 * ------------------------------------------------------------------ */

export default function PriceChart({ symbol, label }: { symbol: string; label: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Record<string, ISeriesApi<'Candlestick' | 'Line' | 'Area' | 'Histogram'>>>({});

  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [chartType, setChartType] = useState<ChartType>('Candles');
  const [showEma, setShowEma] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(false);

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);

  // --- load history -------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/market-data/history?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      setData(json as HistoryResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chart data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    load();
    // Intraday charts keep up with the market; daily and above do not need it.
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  // --- create the chart once ----------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: 'inherit',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(55,65,81,0.35)' },
        horzLines: { color: 'rgba(55,65,81,0.35)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', rightOffset: 4, timeVisible: true, secondsVisible: false },
      localization: { priceFormatter: (price: number) => price.toFixed(2) },
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
    };
  }, []);

  const shifted = useMemo(() => {
    if (!data) return [];
    // Shift by the exchange offset so intraday bars read in market time
    // (the library renders timestamps in UTC).
    const offset = data.intraday ? data.gmtOffsetSeconds : 0;
    return data.candles.map((c) => ({ ...c, time: (c.time + offset) as UTCTimestamp }));
  }, [data]);

  // --- draw -----------------------------------------------------------
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || shifted.length === 0 || !data) return;

    // Rebuild the series set: type, indicator toggles and panes can all change.
    for (const series of Object.values(seriesRef.current)) {
      try {
        chart.removeSeries(series);
      } catch {
        /* already gone */
      }
    }
    seriesRef.current = {};

    const closes = shifted.map((c) => c.close);

    if (chartType === 'Candles') {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
      });
      candles.setData(shifted);
      seriesRef.current.price = candles;
    } else if (chartType === 'Line') {
      const line = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });
      line.setData(shifted.map((c) => ({ time: c.time, value: c.close })));
      seriesRef.current.price = line;
    } else {
      const area = chart.addSeries(AreaSeries, {
        lineColor: '#3b82f6',
        topColor: 'rgba(59,130,246,0.35)',
        bottomColor: 'rgba(59,130,246,0.02)',
        lineWidth: 2,
      });
      area.setData(shifted.map((c) => ({ time: c.time, value: c.close })));
      seriesRef.current.price = area;
    }

    if (showEma) {
      for (const { period, color } of EMA_CONFIG) {
        const values = ema(closes, period);
        if (values.length === 0) continue;
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        series.setData(
          shifted
            .map((c, i) => ({ time: c.time, value: values[i] }))
            .filter((point): point is { time: UTCTimestamp; value: number } => point.value !== null)
        );
        seriesRef.current[`ema${period}`] = series;
      }
    }

    if (showVwap) {
      const values = vwap(shifted, 0);
      const points = shifted
        .map((c, i) => ({ time: c.time, value: values[i] }))
        .filter((point): point is { time: UTCTimestamp; value: number } => point.value !== null);
      if (points.length > 0) {
        const series = chart.addSeries(LineSeries, {
          color: '#e879f9',
          lineWidth: 2,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        series.setData(points);
        seriesRef.current.vwap = series;
      }
    }

    if (showVolume) {
      const volume = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: 'volume' }, priceScaleId: '' },
        1
      );
      volume.setData(
        shifted.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
        }))
      );
      seriesRef.current.volume = volume;
    }

    if (showRsi) {
      const values = rsi(closes, 14);
      const series = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1 }, showVolume ? 2 : 1);
      series.setData(
        shifted
          .map((c, i) => ({ time: c.time, value: values[i] }))
          .filter((point): point is { time: UTCTimestamp; value: number } => point.value !== null)
      );
      seriesRef.current.rsi = series;
    }

    // Keep the price pane dominant, as a trading terminal does.
    try {
      const panes = chart.panes();
      panes[0]?.setHeight(showRsi && showVolume ? 300 : showVolume || showRsi ? 340 : 420);
      panes[1]?.setHeight(90);
      panes[2]?.setHeight(90);
    } catch {
      /* pane sizing is best effort */
    }

    chart.timeScale().fitContent();
  }, [shifted, data, chartType, showEma, showVwap, showVolume, showRsi]);

  // --- crosshair legend ----------------------------------------------
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const byTime = new Map(shifted.map((c) => [c.time as number, c]));
    const handler = (param: { time?: unknown }) => {
      const key = typeof param.time === 'number' ? param.time : null;
      setHover(key !== null ? (byTime.get(key) ?? null) : null);
    };

    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [shifted]);

  const last = shifted.length > 0 ? shifted[shifted.length - 1] : null;
  const shown = hover ?? last;
  const prior = shown
    ? shifted[Math.max(0, shifted.findIndex((c) => c.time === shown.time) - 1)]
    : null;
  const diff = shown && prior ? shown.close - prior.close : null;
  const diffPct = diff !== null && prior && prior.close !== 0 ? (diff / prior.close) * 100 : null;
  const unit = data?.currency === 'USD' ? '$' : '₹';

  function toggleClass(active: boolean) {
    return `rounded-md px-2.5 py-1 text-xs font-semibold transition ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
    }`;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-800 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-white">
            {symbol} <span className="font-normal text-gray-500">{label}</span>
          </p>
          <p className="text-[11px] text-gray-500">
            {data ? `${data.count} candles · ${data.interval} · ${data.exchange}` : 'Loading history…'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button key={tf} onClick={() => setTimeframe(tf)} className={toggleClass(tf === timeframe)}>
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {CHART_TYPES.map((type) => (
            <button key={type} onClick={() => setChartType(type)} className={toggleClass(type === chartType)}>
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowEma(!showEma)} className={toggleClass(showEma)}>
            EMA
          </button>
          <button onClick={() => setShowVwap(!showVwap)} className={toggleClass(showVwap)}>
            VWAP
          </button>
          <button onClick={() => setShowVolume(!showVolume)} className={toggleClass(showVolume)}>
            Volume
          </button>
          <button onClick={() => setShowRsi(!showRsi)} className={toggleClass(showRsi)}>
            RSI
          </button>
        </div>
      </div>

      {/* OHLC legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs tabular-nums">
        {shown ? (
          <>
            <span className="text-gray-500">
              O <span className="text-gray-200">{unit}{shown.open.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              H <span className="text-gray-200">{unit}{shown.high.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              L <span className="text-gray-200">{unit}{shown.low.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              C <span className="font-semibold text-white">{unit}{shown.close.toFixed(2)}</span>
            </span>
            {diff !== null && diffPct !== null && (
              <span className={diff >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {diff >= 0 ? '+' : ''}
                {diff.toFixed(2)} ({diff >= 0 ? '+' : ''}
                {diffPct.toFixed(2)}%)
              </span>
            )}
            <span className="text-gray-500">
              Vol <span className="text-gray-200">{shown.volume.toLocaleString('en-IN')}</span>
            </span>
            {showEma && (
              <span className="ml-auto flex items-center gap-2 text-[11px]">
                {EMA_CONFIG.map((e) => (
                  <span key={e.period} style={{ color: e.color }}>
                    EMA{e.period}
                  </span>
                ))}
                {showVwap && <span style={{ color: '#e879f9' }}>VWAP</span>}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-600">No candle under the cursor</span>
        )}
      </div>

      {/* Canvas */}
      <div className="relative">
        <div ref={containerRef} className="h-[460px] w-full" />

        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {timeframe} candles…
          </div>
        )}

        {error && (
          <div className="absolute inset-x-4 top-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <p className="border-t border-gray-800 px-4 py-2 text-[11px] text-gray-500">
        Delayed data from the same free feed as the dashboard. Intraday times are shown in exchange local time.
        {data?.note ? ` ${data.note}.` : ''} Indicators are computed in the browser from these candles.
      </p>
    </div>
  );
}
