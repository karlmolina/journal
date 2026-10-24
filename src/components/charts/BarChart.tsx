import { useState } from "react";
import useElementWidth from "../../hooks/useElementWidth";
import { niceTicks } from "../../functions/chartScale";

export interface Bar {
  // Axis label; only some are drawn when space is tight.
  label: string;
  value: number;
  tooltip: string;
}

interface BarChartProps {
  bars: Bar[];
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 12, right: 4, bottom: 24, left: 28 };

export default function BarChart({
  bars,
  height = 160,
  ariaLabel,
}: BarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const ticks = niceTicks(0, Math.max(...bars.map((b) => b.value), 1), 3);
  const maxY = ticks[ticks.length - 1];
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / bars.length;
  // Leave a gap between bars; keep them thin.
  const barW = Math.min(Math.max(slot - 4, 2), 28);
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;
  const labelEvery = Math.ceil(
    bars.length / Math.max(Math.floor(plotW / 44), 1),
  );

  const active = hover !== null ? bars[hover] : null;
  const activeX = hover !== null ? PAD.left + slot * hover + slot / 2 : 0;

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
                className="fill-base-content/55 dark:fill-base-content/75 text-[11px] font-semibold tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const top = y(b.value);
            const h = PAD.top + plotH - top;
            // Rounded top, square base on the axis.
            const r = Math.min(4, barW / 2, h);
            const left = cx - barW / 2;
            return (
              <g key={i}>
                {h > 0 && (
                  <path
                    d={`M${left},${top + h} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${top + h} Z`}
                    className={
                      hover === null || hover === i
                        ? "fill-primary"
                        : "fill-primary/40"
                    }
                  />
                )}
                {i % labelEvery === (bars.length - 1) % labelEvery && (
                  <text
                    x={cx}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-base-content/55 dark:fill-base-content/75 text-[11px] font-semibold"
                  >
                    {b.label}
                  </text>
                )}
                <rect
                  x={PAD.left + slot * i}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-xl bg-base-100 px-2.5 py-1.5 text-xs font-semibold shadow-lg border border-base-content/10"
          style={{ left: Math.min(Math.max(activeX, 70), width - 70) }}
        >
          {active.tooltip}
        </div>
      )}
    </div>
  );
}
