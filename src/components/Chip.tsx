import React from "react";

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

// A toggle pill used for filters and multi-select options.
export default function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-95 ${
        selected
          ? "bg-primary text-primary-content"
          : "bg-base-content/8 text-base-content/70 dark:text-base-content/80 hover:text-base-content dark:hover:text-base-content"
      }`}
    >
      {children}
    </button>
  );
}
