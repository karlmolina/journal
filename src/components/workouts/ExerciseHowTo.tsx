import { useState } from "react";
import type { Exercise } from "../../hooks/useExercises";

// The library's description of an exercise, two lines until tapped open.
// Folded, it's just the link, to make room (for the set just finished).
export default function ExerciseHowTo({
  exercise,
  folded = false,
}: {
  exercise?: Exercise;
  folded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Close again when the workout moves on to another exercise, or folds it.
  const [shownFor, setShownFor] = useState(exercise?.id);
  const [wasFolded, setWasFolded] = useState(folded);
  if (exercise?.id !== shownFor || folded !== wasFolded) {
    setShownFor(exercise?.id);
    setWasFolded(folded);
    setOpen(false);
  }

  if (!exercise || (!exercise.description && exercise.steps.length === 0))
    return null;
  const more = exercise.steps.length > 0 || !!exercise.equipment;
  // Short descriptions fit in two lines, so there's nothing to open.
  const toggles = more || folded || (exercise.description?.length ?? 0) > 90;
  const shut = folded && !open;

  return (
    // The whole box is a tap target; the button inside is for keyboards.
    <div
      className={`w-full rounded-xl bg-base-content/5 px-3 py-2 text-left text-sm font-medium text-base-content/75 dark:text-base-content/85 ${toggles ? "cursor-pointer" : ""}`}
      onClick={() => toggles && setOpen(!open)}
    >
      {exercise.description && !shut && (
        <p className={open ? "" : "line-clamp-2"}>{exercise.description}</p>
      )}
      {more && (
        // Stays mounted so it can fold shut as smoothly as it opens.
        <div
          aria-hidden={!open}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            {exercise.steps.length > 0 && (
              <ol className="mt-1.5 list-decimal pl-5 flex flex-col gap-0.5">
                {exercise.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
            {exercise.equipment && (
              <p className="mt-1.5">
                <span className="font-bold">Equipment:</span>{" "}
                {exercise.equipment}
              </p>
            )}
          </div>
        </div>
      )}
      {toggles && (
        <button
          type="button"
          className={`${shut ? "" : "mt-0.5 "}block text-xs font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] cursor-pointer`}
          aria-expanded={open}
        >
          {open ? "Show less" : more || shut ? "How to do it" : "Show more"}
        </button>
      )}
    </div>
  );
}
