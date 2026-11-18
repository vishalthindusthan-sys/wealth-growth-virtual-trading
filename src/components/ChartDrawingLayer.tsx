'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type DrawingTool = 'cursor' | 'trend' | 'hline' | 'rect' | 'fib';

/** A point is stored in chart space (epoch seconds + price), never in pixels,
 *  so a drawing survives panning, zooming and a change of timeframe. */
export interface DrawPoint {
  time: number;
  price: number;
}

export type Drawing =
  | { id: string; kind: 'trend'; a: DrawPoint; b: DrawPoint }
  | { id: string; kind: 'hline'; price: number }
  | { id: string; kind: 'rect'; a: DrawPoint; b: DrawPoint }
  | { id: string; kind: 'fib'; a: DrawPoint; b: DrawPoint };

const STROKE = '#60a5fa';
const STROKE_SELECTED = '#f59e0b';
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/* ------------------------------------------------------------------ *
 * time <-> logical index
 *
 * The library maps pixels to "logical" bar indices, which also work outside
 * the data range. Times are converted to a fractional index against the
 * candle list so a drawing keeps its place when the timeframe changes.
 * ------------------------------------------------------------------ */

function timeToLogical(times: number[], time: number) {
  if (times.length === 0) return null;
  if (times.length === 1) return 0;

  if (time <= times[0]) {
    const step = times[1] - times[0] || 1;
    return (time - times[0]) / step;
  }
  const last = times.length - 1;
  if (time >= times[last]) {
    const step = times[last] - times[last - 1] || 1;
    return last + (time - times[last]) / step;
  }

  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo] || 1;
  return lo + (time - times[lo]) / span;
}

function logicalToTime(times: number[], logical: number) {
  if (times.length === 0) return null;
  if (times.length === 1) return times[0];

  const last = times.length - 1;
  if (logical <= 0) {
    const step = times[1] - times[0] || 1;
    return Math.round(times[0] + logical * step);
  }
  if (logical >= last) {
    const step = times[last] - times[last - 1] || 1;
    return Math.round(times[last] + (logical - last) * step);
  }

  const lo = Math.floor(logical);
  const frac = logical - lo;
  return Math.round(times[lo] + frac * ((times[lo + 1] - times[lo]) || 1));
}

/* ------------------------------------------------------------------ *
 * Layer
 * ------------------------------------------------------------------ */

export default function ChartDrawingLayer({
  chart,
  series,
  times,
  tool,
  drawings,
  selectedId,
  onCommit,
  onSelect,
  onToolDone,
}: {
  chart: IChartApi | null;
  series: ISeriesApi<SeriesType> | null;
  times: number[];
  tool: DrawingTool;
  drawings: Drawing[];
  selectedId: string | null;
  onCommit: (drawing: Drawing) => void;
  onSelect: (id: string | null) => void;
  onToolDone: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, forceRender] = useState(0);
  const [pending, setPending] = useState<DrawPoint | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const redraw = useCallback(() => forceRender((n) => n + 1), []);

  // Re-render whenever the chart moves under us.
  useEffect(() => {
    if (!chart) return;
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(redraw);
    timeScale.subscribeSizeChange(redraw);
    window.addEventListener('resize', redraw);
    const settle = setTimeout(redraw, 80); // after the initial fitContent
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(redraw);
      timeScale.unsubscribeSizeChange(redraw);
      window.removeEventListener('resize', redraw);
      clearTimeout(settle);
    };
  }, [chart, redraw]);

  useEffect(() => {
    redraw();
  }, [times, drawings, selectedId, tool, redraw]);

  // Escape cancels a half-finished drawing; Delete removes the selected one.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPending(null);
        onToolDone();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToolDone]);

  if (!chart || !series) return null;

  const x = (time: number) => {
    const logical = timeToLogical(times, time);
    if (logical === null) return null;
    const coord = chart.timeScale().logicalToCoordinate(logical as never);
    return coord === null ? null : Number(coord);
  };
  const y = (price: number) => {
    const coord = series.priceToCoordinate(price);
    return coord === null ? null : Number(coord);
  };

  function pointFromEvent(event: React.MouseEvent): DrawPoint | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !chart || !series) return null;

    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const logical = chart.timeScale().coordinateToLogical(px);
    const price = series.coordinateToPrice(py);
    if (logical === null || price === null) return null;

    const time = logicalToTime(times, Number(logical));
    if (time === null) return null;
    return { time, price: Number(price) };
  }

  function onClick(event: React.MouseEvent) {
    if (tool === 'cursor') {
      onSelect(null);
      return;
    }

    const point = pointFromEvent(event);
    if (!point) return;

    if (tool === 'hline') {
      onCommit({ id: crypto.randomUUID(), kind: 'hline', price: point.price });
      onToolDone();
      return;
    }

    if (!pending) {
      setPending(point);
      return;
    }

    onCommit({ id: crypto.randomUUID(), kind: tool, a: pending, b: point } as Drawing);
    setPending(null);
    onToolDone();
  }

  function onMove(event: React.MouseEvent) {
    if (tool === 'cursor') return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  // Horizontal lines stop short of the right price scale.
  const width = Math.max(0, (svgRef.current?.clientWidth ?? 0) - (chart.priceScale('right').width() ?? 0));
  const drawingTool = tool !== 'cursor';

  function renderDrawing(drawing: Drawing) {
    const selected = drawing.id === selectedId;
    const stroke = selected ? STROKE_SELECTED : STROKE;
    const clickProps = {
      onClick: (event: React.MouseEvent) => {
        if (drawingTool) return;
        event.stopPropagation();
        onSelect(drawing.id);
      },
      style: { cursor: drawingTool ? 'crosshair' : 'pointer' } as React.CSSProperties,
      pointerEvents: 'stroke' as const,
    };

    if (drawing.kind === 'hline') {
      const py = y(drawing.price);
      if (py === null) return null;
      return (
        <g key={drawing.id}>
          <line
            x1={0}
            x2={width}
            y1={py}
            y2={py}
            stroke={stroke}
            strokeWidth={selected ? 2.5 : 1.5}
            strokeDasharray="6 4"
            {...clickProps}
          />
          <text x={6} y={py - 5} fill={stroke} fontSize={11} className="tabular-nums">
            {drawing.price.toFixed(2)}
          </text>
        </g>
      );
    }

    const ax = x(drawing.a.time);
    const bx = x(drawing.b.time);
    const ay = y(drawing.a.price);
    const by = y(drawing.b.price);
    if (ax === null || bx === null || ay === null || by === null) return null;

    if (drawing.kind === 'trend') {
      return (
        <g key={drawing.id}>
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke={stroke} strokeWidth={selected ? 3 : 2} {...clickProps} />
          {selected && (
            <>
              <circle cx={ax} cy={ay} r={4} fill={stroke} />
              <circle cx={bx} cy={by} r={4} fill={stroke} />
            </>
          )}
        </g>
      );
    }

    if (drawing.kind === 'rect') {
      return (
        <rect
          key={drawing.id}
          x={Math.min(ax, bx)}
          y={Math.min(ay, by)}
          width={Math.abs(bx - ax)}
          height={Math.abs(by - ay)}
          fill="rgba(96,165,250,0.10)"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
          {...clickProps}
          pointerEvents={drawingTool ? 'none' : 'all'}
        />
      );
    }

    // Fibonacci retracement between the two prices.
    const left = Math.min(ax, bx);
    const right = Math.max(ax, bx);
    const high = Math.max(drawing.a.price, drawing.b.price);
    const low = Math.min(drawing.a.price, drawing.b.price);

    return (
      <g key={drawing.id} {...clickProps}>
        {FIB_LEVELS.map((level) => {
          const price = high - (high - low) * level;
          const py = y(price);
          if (py === null) return null;
          return (
            <g key={level}>
              <line
                x1={left}
                x2={right}
                y1={py}
                y2={py}
                stroke={stroke}
                strokeWidth={level === 0 || level === 1 ? 2 : 1}
                strokeDasharray={level === 0 || level === 1 ? undefined : '4 4'}
                opacity={0.9}
              />
              <text x={right + 4} y={py - 3} fill={stroke} fontSize={10} className="tabular-nums">
                {(level * 100).toFixed(1)}% · {price.toFixed(2)}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  // Preview of the drawing in progress.
  let preview: React.ReactNode = null;
  if (pending && cursor) {
    const px = x(pending.time);
    const py = y(pending.price);
    if (px !== null && py !== null) {
      preview =
        tool === 'rect' ? (
          <rect
            x={Math.min(px, cursor.x)}
            y={Math.min(py, cursor.y)}
            width={Math.abs(cursor.x - px)}
            height={Math.abs(cursor.y - py)}
            fill="rgba(96,165,250,0.08)"
            stroke={STROKE}
            strokeDasharray="4 4"
          />
        ) : (
          <line
            x1={px}
            y1={py}
            x2={cursor.x}
            y2={cursor.y}
            stroke={STROKE}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        );
    }
  }

  return (
    <svg
      ref={svgRef}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={() => setCursor(null)}
      className="absolute inset-0 h-full w-full"
      // In cursor mode the chart keeps its own pan and zoom: only the shapes
      // themselves accept clicks, so the layer never swallows a drag.
      style={{ pointerEvents: drawingTool ? 'all' : 'none', cursor: drawingTool ? 'crosshair' : 'default' }}
    >
      <g pointerEvents={drawingTool ? 'none' : 'auto'}>{drawings.map(renderDrawing)}</g>
      {preview}
    </svg>
  );
}
