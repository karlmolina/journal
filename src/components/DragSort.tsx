import type React from "react";
import useDragSort, { type DragSort } from "../hooks/useDragSort";

// useDragSort for a list drawn inside a loop, where a hook can't go.
export function DragSortList({
  onDrop,
  onLift,
  children,
}: {
  onDrop: (from: number, to: number) => void;
  // Given, its items lift when held, and this says when.
  onLift?: (lifted: boolean) => void;
  children: (sort: DragSort) => React.ReactNode;
}) {
  return children(useDragSort(onDrop, onLift));
}

// The six-dot handle to drag an item by.
export function Grip({
  sort,
  index,
  label,
}: {
  sort: DragSort;
  index: number;
  label: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-square -ml-1 shrink-0 cursor-grab active:cursor-grabbing text-base-content/45 dark:text-base-content/70"
      aria-label={label}
      {...sort.handle(index)}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-5"
        fill="currentColor"
        aria-hidden
      >
        {[4, 8, 12].map((y) =>
          [5.5, 10.5].map((x) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={1.4} />
          )),
        )}
      </svg>
    </button>
  );
}
