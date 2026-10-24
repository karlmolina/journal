import { useState } from "react";
import type { Exercise } from "../../hooks/useExercises";

// The library's description of an exercise, two lines until tapped open.
export default function ExerciseHowTo({ exercise }: { exercise?: Exercise }) {
  const [open, setOpen] = useState(false);
  // Close again when the workout moves on to another exercise.
  const [shownFor, setShownFor] = useState(exercise?.id);
  if (exercise?.id !== shownFor) {
    setShownFor(exercise?.id);
    setOpen(false);
  }

  if (!exercise || (!exercise.description && exercise.steps.length === 0))
    return null;
  const more = exercise.steps.length > 0 || !!exercise.equipment;
  // Short descriptions fit in two lines, so there's nothing to open.
  const toggles = more || (exercise.description?.length ?? 0) > 90;

  return (
    // The whole box is a tap target; the button inside is for keyboards.
    <div
      className={`w-full rounded-xl bg-base-content/5 px-3 py-2 text-left text-sm font-medium text-base-content/75 dark:text-base-content/85 ${toggles ? "cursor-pointer" : ""}`}
      onClick={() => toggles && setOpen(!open)}
    >
      {exercise.description && (
        <p className={open ? "" : "line-clamp-2"}>{exercise.description}</p>
      )}
      {open && exercise.steps.length > 0 && (
        <ol className="mt-1.5 list-decimal pl-5 flex flex-col gap-0.5">
          {exercise.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      {open && exercise.equipment && (
        <p className="mt-1.5">
          <span className="font-bold">Equipment:</span> {exercise.equipment}
        </p>
      )}
      {toggles && (
        <button
          type="button"
          className="mt-0.5 block text-xs font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] cursor-pointer"
          aria-expanded={open}
        >
          {open ? "Show less" : more ? "How to do it" : "Show more"}
        </button>
      )}
    </div>
  );
}
