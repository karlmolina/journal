import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Height of one row of the wheel, in pixels.
export const ROW_PX = 48;
// Rows shown above and below the centered one.
const SIDE_ROWS = 4;

// The big scroll wheel that floats over the page while you drag a number
// field. `position` counts rows from the value the drag started at and can sit
// between rows while the wheel moves; the row nearest the middle is the pick.
export default function WheelPicker({
  label,
  position,
  rowText,
  hasRow,
  closing,
}: {
  label: string;
  position: number;
  rowText: (row: number) => string;
  hasRow: (row: number) => boolean;
  closing: boolean;
}) {
  // Starts small and see-through, then grows in on the next frame.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const visible = shown && !closing;

  const center = Math.round(position);
  const rows = [];
  for (let row = center - SIDE_ROWS - 1; row <= center + SIDE_ROWS + 1; row++) {
    if (!hasRow(row)) continue;
    const offset = row - position;
    const distance = Math.min(Math.abs(offset), SIDE_ROWS + 1);
    rows.push(
      <div
        key={row}
        className={`absolute inset-x-0 top-1/2 flex items-center justify-center tabular-nums ${
          row === center
            ? "text-4xl font-extrabold text-base-content"
            : "text-2xl font-bold text-base-content/70"
        }`}
        style={{
          height: ROW_PX,
          marginTop: -ROW_PX / 2,
          transform: `translateY(${offset * ROW_PX}px) rotateX(${-offset * 18}deg) scale(${1 - distance * 0.06})`,
          opacity: Math.max(0, 1 - distance / (SIDE_ROWS + 1)),
        }}
      >
        {rowText(row)}
      </div>,
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-base-100/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        className={`flex w-64 max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-3xl bg-base-200 px-4 pt-4 pb-3 shadow-2xl ring-1 ring-base-content/10 transition duration-200 ease-out motion-reduce:transition-none ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-3"
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55 dark:text-base-content/75">
          {label}
        </span>
        <div
          className="relative w-full overflow-hidden"
          style={{ height: ROW_PX * (SIDE_ROWS * 2 + 1), perspective: 600 }}
        >
          <div
            className="absolute inset-x-0 top-1/2 rounded-2xl bg-primary/12 dark:bg-primary/25"
            style={{ height: ROW_PX, marginTop: -ROW_PX / 2 }}
          />
          {rows}
        </div>
      </div>
    </div>,
    document.body,
  );
}
