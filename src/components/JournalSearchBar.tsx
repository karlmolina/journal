import type React from "react";

// In place of the entry box while searching: the search field, with a way
// back on the left and clear (or close, once empty) on the right.
export default function JournalSearchBar({
  text,
  searching,
  onChange,
  onSubmit,
  onClear,
  onClose,
}: {
  text: string;
  searching: boolean;
  onChange: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 bg-base-100 flex items-end gap-2 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pt-10 sm:pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
    >
      <label className="input relative flex-1 h-14 rounded-3xl bg-base-content/8 border-0 shadow-sm text-lg font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)] gap-0 pl-14 pr-14 sm:h-16 sm:pl-16 sm:pr-16 focus-within:outline-none [&_input]:placeholder:text-base-content/50">
        <button
          type="button"
          className="btn btn-ghost btn-circle absolute z-10 left-2 bottom-2 sm:left-3 sm:bottom-3"
          onClick={onClose}
          aria-label="Close search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <input
          type="text"
          autoFocus
          placeholder="Search entries..."
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        {searching && (
          <span className="loading loading-spinner loading-xs"></span>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-circle absolute z-10 right-2 bottom-2 sm:right-3 sm:bottom-3"
          // Clear the text first; close search if there's nothing to clear.
          onClick={text ? onClear : onClose}
          aria-label={text ? "Clear search" : "Close search"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </label>
    </form>
  );
}
