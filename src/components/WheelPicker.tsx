import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Height of one row of the wheel, in pixels, and of a row with a description
// under its value.
export const ROW_PX = 48;
export const DETAIL_ROW_PX = 68;
// Rows shown above and below the centered one; taller rows show fewer.
const SIDE_ROWS = 4;
const DETAIL_SIDE_ROWS = 3;

// The big scroll wheel that floats over the page while you drag a number
// field. `position` counts rows from the value the drag started at and can sit
// between rows while the wheel moves; the row nearest the middle is the pick.
// Higher values sit above, so dragging down pulls them into the middle.
// `bind` lets a finger that lands on the wheel keep turning it.
export default function WheelPicker({
  label,
  position,
  rowText,
  rowDetail,
  hasRow,
  closing,
  bind,
}: {
  label: string;
  position: number;
  rowText: (row: number) => string;
  rowDetail?: (row: number) => string;
  hasRow: (row: number) => boolean;
  closing: boolean;
  bind: React.HTMLAttributes<HTMLDivElement>;
}) {
  // Starts small and see-through, then grows in on the next frame.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const visible = shown && !closing;

  const rowPx = rowDetail ? DETAIL_ROW_PX : ROW_PX;
  const sideRows = rowDetail ? DETAIL_SIDE_ROWS : SIDE_ROWS;
  const center = Math.round(position);
  const rows = [];
  for (let row = center - sideRows - 1; row <= center + sideRows + 1; row++) {
    if (!hasRow(row)) continue;
    const offset = position - row;
    const distance = Math.min(Math.abs(offset), sideRows + 1);
    rows.push(
      <div
        key={row}
        className={`absolute inset-x-0 top-1/2 flex flex-col items-center justify-center tabular-nums ${
          row === center
            ? "text-4xl font-extrabold text-base-content"
            : "text-2xl font-bold text-base-content/70"
        }`}
        style={{
          height: rowPx,
          marginTop: -rowPx / 2,
          transform: `translateY(${offset * rowPx}px) rotateX(${-offset * 18}deg) scale(${1 - distance * 0.06})`,
          opacity: Math.max(0, 1 - distance / (sideRows + 1)),
        }}
      >
        <span className={rowDetail ? "leading-none" : undefined}>
          {rowText(row)}
        </span>
        {rowDetail && (
          <span className="mt-1 line-clamp-2 px-2 text-center text-xs leading-tight font-semibold">
            {rowDetail(row)}
          </span>
        )}
      </div>,
    );
  }

  return createPortal(
    <div
      {...bind}
      className={`fixed inset-0 z-50 flex cursor-ns-resize touch-none items-center justify-center bg-base-100/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        className={`flex ${rowDetail ? "w-80" : "w-64"} max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-3xl bg-base-200 px-4 pt-4 pb-3 shadow-2xl ring-1 ring-base-content/10 transition duration-200 ease-out motion-reduce:transition-none ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-3"
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55 dark:text-base-content/75">
          {label}
        </span>
        <div
          className="relative w-full overflow-hidden"
          style={{ height: rowPx * (sideRows * 2 + 1), perspective: 600 }}
        >
          <div
            className="absolute inset-x-0 top-1/2 rounded-2xl bg-primary/12 dark:bg-primary/25"
            style={{ height: rowPx, marginTop: -rowPx / 2 }}
          />
          {rows}
        </div>
      </div>
    </div>,
    document.body,
  );
}
