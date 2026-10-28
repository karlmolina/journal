import { useState } from "react";
import type { SessionExercise } from "../../functions/planProgress";
import ExerciseInput from "./ExerciseInput";
import { boldFieldClass } from "../fieldClass";

// An exercise as the checklist counts it: one ended early needs only the
// sets already done.
export type Step = SessionExercise & { planned_sets: number };

export const actionClass =
  "btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";

// At the foot of each exercise's card: do it now instead of the current
// one, swap it for another for this workout, or end it before all its sets
// are done.
export default function StepActions({
  step,
  complete,
  suggestions,
  onPick,
  onSwap,
  onEnd,
}: {
  step: Step;
  complete: boolean;
  suggestions: string[];
  onPick?: () => void;
  onSwap: (name: string) => void;
  onEnd: (ended: boolean) => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const [name, setName] = useState("");

  if (swapping) {
    const swap = () => {
      if (!name.trim()) return;
      onSwap(name);
      setSwapping(false);
      setName("");
    };
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-base-content/5 p-2">
        <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 px-1">
          Do something else instead of {step.name}, just this workout.
        </p>
        <ExerciseInput
          className={boldFieldClass}
          value={name}
          onChange={setName}
          suggestions={suggestions.filter(
            (n) => n.toLowerCase() !== step.name.toLowerCase(),
          )}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full font-bold flex-1"
            onClick={() => setSwapping(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-full font-bold flex-1"
            onClick={swap}
            disabled={!name.trim()}
          >
            Swap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {onPick && (
        <button type="button" className={actionClass} onClick={onPick}>
          Do this now
        </button>
      )}
      <button
        type="button"
        className={actionClass}
        onClick={() => setSwapping(true)}
      >
        Swap exercise
      </button>
      {step.swapped_from && (
        <button
          type="button"
          className={actionClass}
          onClick={() => onSwap(step.swapped_from!)}
        >
          Back to {step.swapped_from}
        </button>
      )}
      {step.ended ? (
        <button
          type="button"
          className={actionClass}
          onClick={() => onEnd(false)}
        >
          Pick back up
        </button>
      ) : (
        !complete && (
          <button
            type="button"
            className={actionClass}
            onClick={() => onEnd(true)}
          >
            End early
          </button>
        )
      )}
    </div>
  );
}
