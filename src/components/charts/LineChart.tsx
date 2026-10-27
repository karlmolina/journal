import React, { useState } from "react";
import useElementWidth from "../../hooks/useElementWidth";
import {
  niceTicks,
  SERIES_COLORS,
  seriesColor,
} from "../../functions/chartScale";

export interface LinePoint {
  // Milliseconds since the epoch.
  x: number;
  y: number;
  // Shown in the tooltip, e.g. "135 lb × 8".
  label: string;
}

export interface LineSeries {
  id: string;
  name: string;
  // A CSS color, e.g. seriesColor(0).
  color: string;
  // Oldest first.
  points: LinePoint[];
  dashed?: boolean;
  // Past the eight colors: drawn in gray and toggled together as "Other".
  other?: boolean;
}

interface LineChartProps {
  series: LineSeries[];
  // Fixed y range (e.g. 0–10 for pain); otherwise fitted to the shown lines.
  yDomain?: [number, number];
  formatY?: (y: number) => string;
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 12, right: 14, bottom: 24 };
const OTHER = "__other";

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dayKey = (ms: number) => new Date(ms).toDateString();

export default function LineChart({
  series,
  yDomain,
  formatY = (y) => String(y),
  height = 220,
  ariaLabel,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // The line under the finger (or the legend item under the mouse).
  const [focus, setFocus] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const legendId = (s: LineSeries) => (s.other ? OTHER : s.id);
  const shown = series.filter((s) => !hidden.has(legendId(s)));
  const others = series.filter((s) => s.other);

  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const ys = (shown.length ? shown : series).flatMap((s) =>
    s.points.map((p) => p.y),
  );
  const ticks = yDomain
    ? niceTicks(yDomain[0], yDomain[1], 5)
    : niceTicks(Math.min(0, ...ys), Math.max(0, ...ys));
  const minY = ticks[0];
  const maxY = ticks[ticks.length - 1];

  // Room for the widest y label, e.g. "-200%".
  const padLeft = 14 + Math.max(...ticks.map((t) => formatY(t).length)) * 6.5;
  const pad = { ...PAD, left: padLeft };
  const plotW = Math.max(width - pad.left - pad.right, 1);
  const plotH = height - pad.top - pad.bottom;
  // A single date sits in the middle.
  const x = (v: number) =>
    pad.left +
    (maxX === minX ? plotW / 2 : ((v - minX) / (maxX - minX)) * plotW);
  const y = (v: number) =>
    pad.top + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  const handleMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left + pad.left;
    const py = e.clientY - box.top;
    // Snap to the nearest date any shown line has, then focus the line
    // closest to the pointer on that date.
    let best: { x: number; d: number } | null = null;
    for (const s of shown)
      for (const p of s.points) {
        const d = Math.abs(x(p.x) - px);
        if (!best || d < best.d) best = { x: p.x, d };
      }
    if (!best) return;
    const day = dayKey(best.x);
    let near: { id: string; d: number } | null = null;
    for (const s of shown) {
      const p = s.points.find((q) => dayKey(q.x) === day);
      if (!p) continue;
      const d = Math.abs(y(p.y) - py);
      if (!near || d < near.d) near = { id: s.id, d };
    }
    setHoverX(best.x);
    setFocus(near?.id ?? null);
  };
  const clearHover = () => {
    setHoverX(null);
    setFocus(null);
  };

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hoverDay = hoverX !== null ? dayKey(hoverX) : null;
  const rows = hoverDay
    ? shown.flatMap((s) => {
        const p = s.points.find((q) => dayKey(q.x) === hoverDay);
        return p ? [{ s, p }] : [];
      })
    : [];
  // Focused line on top and its tooltip row first, the rest top to bottom.
  rows.sort(
    (a, b) =>
      Number(b.s.id === focus) - Number(a.s.id === focus) || b.p.y - a.p.y,
  );
  const drawOrder = [...shown].sort(
    (a, b) =>
      Number(!a.other) - Number(!b.other) ||
      Number(a.id === focus) - Number(b.id === focus),
  );
  const dim = (s: LineSeries) =>
    focus !== null && s.id !== focus && !(focus === OTHER && s.other);

  // Dots on every point only for a few roomy lines; single sessions always.
  const markers = (s: LineSeries) =>
    s.points.length === 1 ||
    (shown.length <= 3 && s.points.length <= plotW / 18);
  // First, middle and last dates are enough to orient the reader.
  const dateTicks = [minX, (minX + maxX) / 2, maxX].filter(
    (t, i, all) => all.findIndex((u) => shortDate(u) === shortDate(t)) === i,
  );

  return (
    <div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(t)}
                  y2={y(t)}
                  className={
                    t === 0 && minY < 0
                      ? "stroke-base-content/30"
                      : "stroke-base-content/10"
                  }
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-base-content/55 dark:fill-base-content/75 text-[11px] font-semibold tabular-nums"
                >
                  {formatY(t)}
                </text>
              </g>
            ))}
            {maxX !== minX &&
              dateTicks.map((t, i) => (
                <text
                  key={t}
                  x={x(t)}
                  y={height - 6}
                  textAnchor={
                    i === 0
                      ? "start"
                      : i === dateTicks.length - 1
                        ? "end"
                        : "middle"
                  }
                  className="fill-base-content/55 dark:fill-base-content/75 text-[11px] font-semibold"
                >
                  {shortDate(t)}
                </text>
              ))}
            {hoverX !== null && (
              <line
                x1={x(hoverX)}
                x2={x(hoverX)}
                y1={pad.top}
                y2={pad.top + plotH}
                className="stroke-base-content/25"
                strokeWidth={1}
              />
            )}
            {drawOrder.map((s) => {
              const color = s.color;
              return (
                <g
                  key={s.id}
                  style={{
                    opacity: dim(s) ? 0.18 : 1,
                    transition: "opacity 150ms",
                  }}
                >
                  {s.points.length > 1 && (
                    <polyline
                      points={s.points
                        .map((p) => `${x(p.x)},${y(p.y)}`)
                        .join(" ")}
                      fill="none"
                      stroke={color}
                      strokeWidth={s.id === focus ? 3 : s.other ? 1.5 : 2}
                      strokeDasharray={s.dashed ? "5 4" : undefined}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  {s.points.map((p, i) => {
                    const active = dayKey(p.x) === hoverDay;
                    if (!active && !markers(s)) return null;
                    return (
                      <circle
                        key={i}
                        cx={x(p.x)}
                        cy={y(p.y)}
                        r={active ? 5 : s.other ? 3 : 4}
                        fill={color}
                        className="stroke-base-100"
                        strokeWidth={2}
                      />
                    );
                  })}
                </g>
              );
            })}
            <rect
              x={pad.left - 8}
              y={0}
              width={plotW + 16}
              height={height}
              fill="transparent"
              style={{ touchAction: "pan-y" }}
              onPointerMove={handleMove}
              onPointerDown={handleMove}
              onPointerLeave={clearHover}
              onPointerCancel={clearHover}
            />
          </svg>
        )}
        {hoverX !== null && rows.length > 0 && (
          <div
            // Below the axis, over the legend, so it never hides the lines.
            className="pointer-events-none absolute inset-x-0 z-10 rounded-xl bg-base-100 px-3 py-2 text-xs font-semibold shadow-lg border border-base-content/10"
            style={{ top: height + 4 }}
          >
            <p className="mb-1 text-base-content/55 dark:text-base-content/75">
              {shortDate(hoverX)}
            </p>
            {rows.slice(0, 6).map(({ s, p }) => (
              <p
                key={s.id}
                className={`flex items-center gap-2 py-0.5 ${
                  s.id === focus
                    ? ""
                    : "text-base-content/75 dark:text-base-content/85"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto pl-2 whitespace-nowrap tabular-nums">
                  {p.label}
                </span>
              </p>
            ))}
            {rows.length > 6 && (
              <p className="pt-0.5 text-base-content/55 dark:text-base-content/75">
                +{rows.length - 6} more
              </p>
            )}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Lines">
          {[
            ...series.filter((s) => !s.other),
            ...(others.length
              ? [
                  {
                    id: OTHER,
                    name: `Other (${others.length})`,
                    color: seriesColor(SERIES_COLORS),
                    points: [],
                  } as LineSeries,
                ]
              : []),
          ].map((s) => {
            const off = hidden.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggle(s.id)}
                  onPointerEnter={(e) =>
                    e.pointerType === "mouse" && !off && setFocus(s.id)
                  }
                  onPointerLeave={(e) =>
                    e.pointerType === "mouse" && setFocus(null)
                  }
                  className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    off
                      ? "text-base-content/40 dark:text-base-content/50 bg-transparent"
                      : "bg-base-content/6 dark:bg-base-content/10 hover:bg-base-content/12"
                  }`}
                >
                  <svg width={16} height={8} aria-hidden="true">
                    <line
                      x1={1.5}
                      x2={14.5}
                      y1={4}
                      y2={4}
                      stroke={off ? "currentColor" : s.color}
                      strokeOpacity={off ? 0.5 : 1}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeDasharray={s.dashed ? "4 3" : undefined}
                    />
                  </svg>
                  <span className={off ? "line-through" : ""}>{s.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
