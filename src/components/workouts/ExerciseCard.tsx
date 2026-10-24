import { useState } from "react";
import type { Exercise } from "../../hooks/useExercises";
import { regionLabel } from "../../functions/bodyRegions";

const CATEGORY_LABELS: Record<Exercise["category"], string> = {
  mobility: "Mobility",
  stability: "Stability",
  strength: "Strength",
  stretch: "Stretch",
};

interface ExerciseCardProps {
  exercise: Exercise;
  onLog: () => void;
  // Only for exercises the person added themselves.
  onDelete?: () => void;
}

export default function ExerciseCard({
  exercise,
  onLog,
  onDelete,
}: ExerciseCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = [CATEGORY_LABELS[exercise.category], exercise.dosage]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-2xl bg-base-content/5 dark:bg-base-content/9">
      <button
        type="button"
        className="w-full text-left px-4 py-3 sm:px-5 sm:py-4 cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-bold leading-snug">{exercise.name}</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mt-1.5 shrink-0 text-base-content/40 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-base-content/55 dark:text-base-content/70">
          {meta}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercise.purposes.map((p) => (
            <span
              key={p}
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                p === "healing"
                  ? "bg-secondary/15 text-secondary"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {p === "healing" ? "Healing" : "Prevention"}
            </span>
          ))}
          {exercise.body_regions.map((r) => (
            <span
              key={r}
              className="rounded-full bg-base-content/8 px-2 py-0.5 text-xs font-semibold text-base-content/70"
            >
              {regionLabel(r)}
            </span>
          ))}
          {exercise.user_id && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
              Yours
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 sm:px-5 flex flex-col gap-3 font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)]">
          {exercise.description && <p>{exercise.description}</p>}
          {exercise.steps.length > 0 && (
            <ol className="list-decimal pl-5 flex flex-col gap-1">
              {exercise.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          {exercise.equipment && (
            <p className="text-sm">
              <span className="font-bold">Equipment:</span> {exercise.equipment}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 mt-1">
            {onDelete &&
              (confirmDelete ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost rounded-full font-bold"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-error rounded-full font-bold"
                    onClick={onDelete}
                  >
                    Delete exercise
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              ))}
            {!confirmDelete && (
              <button
                type="button"
                className="btn btn-sm btn-primary rounded-full font-bold"
                onClick={onLog}
              >
                Log this exercise
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
