import type { Progression } from "../../functions/progression";

export interface ProgressionChoice {
  suggestion: Progression;
  // Whether it's taken: the first set starts with its numbers.
  taken: boolean;
  onTake: () => void;
  onUndo: () => void;
}

// Under an exercise's title before its first set, when you hit every set
// last time: what to try today, as a small button you can take or leave.
// Not a second big button: the start button stays the one to press.
export default function ProgressionNudge({
  suggestion,
  taken,
  onTake,
  onUndo,
}: ProgressionChoice) {
  return (
    <div
      className="mt-2 flex items-center gap-3 rounded-2xl border border-success/40 bg-success/8 px-3 py-2 text-left"
      role="note"
      aria-label="Progression"
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5 shrink-0 text-success"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 0 1-.75-.75V5.56l-3.72 3.72a.75.75 0 1 1-1.06-1.06l5-5a.75.75 0 0 1 1.06 0l5 5a.75.75 0 1 1-1.06 1.06l-3.72-3.72v10.69A.75.75 0 0 1 10 17Z"
          clipRule="evenodd"
        />
      </svg>
      <p className="min-w-0 flex-1 text-sm font-medium text-base-content/75 dark:text-base-content/85">
        {taken ? (
          <>
            Going up to{" "}
            <span className="font-bold text-base-content">
              {suggestion.label}
            </span>{" "}
            today.
          </>
        ) : (
          suggestion.reason
        )}
      </p>
      {taken ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/60 dark:text-base-content/80"
          onClick={onUndo}
        >
          Undo
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm rounded-full border-success/50 bg-base-100 font-bold whitespace-nowrap"
          onClick={onTake}
        >
          Try {suggestion.label}
        </button>
      )}
    </div>
  );
}
