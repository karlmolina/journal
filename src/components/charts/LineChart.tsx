import React, { useState } from "react";
import useElementWidth from "../../hooks/useElementWidth";
import { niceTicks } from "../../functions/chartScale";

export interface LinePoint {
  // Milliseconds since the epoch.
  x: number;
  y: number;
  // Shown in the tooltip, e.g. "135 lb × 8".
  label: string;
}

interface LineChartProps {
  points: LinePoint[];
  // Fixed y range (e.g. 0–10 for pain); otherwise fitted to the data from 0.
  yDomain?: [number, number];
  formatY?: (y: number) => string;
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function LineChart({
  points,
  yDomain,
  formatY = (y) => String(y),
  height = 180,
  ariaLabel,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const ticks = yDomain
    ? niceTicks(yDomain[0], yDomain[1], 5)
    : niceTicks(0, Math.max(...points.map((p) => p.y)));
  const minY = ticks[0];
  const maxY = ticks[ticks.length - 1];

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;
  // A single point sits in the middle.
  const x = (v: number) =>
    PAD.left +
    (maxX === minX ? plotW / 2 : ((v - minX) / (maxX - minX)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  const handleMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left + PAD.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.x) - px) < Math.abs(x(points[best].x) - px)) best = i;
    });
    setHover(best);
  };

  const active = hover !== null ? points[hover] : null;
  // Dots on every point only while they have room; the hovered one always shows.
  const showMarkers = points.length <= plotW / 16;
  // First, middle and last dates are enough to orient the reader.
  const dateTicks = [minX, (minX + maxX) / 2, maxX].filter(
    (t, i, all) => all.findIndex((u) => shortDate(u) === shortDate(t)) === i,
  );

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-base-content/10"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-base-content/55 text-[11px] font-semibold tabular-nums"
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
                className="fill-base-content/55 text-[11px] font-semibold"
              >
                {shortDate(t)}
              </text>
            ))}
          {active && (
            <line
              x1={x(active.x)}
              x2={x(active.x)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="stroke-base-content/25"
              strokeWidth={1}
            />
          )}
          <polyline
            points={points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) =>
            !showMarkers && hover !== i ? null : (
              <circle
                key={i}
                cx={x(p.x)}
                cy={y(p.y)}
                r={hover === i ? 5 : 4}
                className="fill-primary stroke-base-100"
                strokeWidth={2}
              />
            ),
          )}
          <rect
            x={PAD.left}
            y={0}
            width={plotW}
            height={height}
            fill="transparent"
            onPointerMove={handleMove}
            onPointerDown={handleMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-xl bg-base-100 px-2.5 py-1.5 text-xs font-semibold shadow-lg border border-base-content/10"
          style={{
            left: Math.min(Math.max(x(active.x), 60), width - 60),
          }}
        >
          <span className="text-base-content/55">{shortDate(active.x)}</span>{" "}
          {active.label}
        </div>
      )}
    </div>
  );
}
