import { useEffect, useRef, useState } from "react";
import type { SessionExercise } from "../../functions/planProgress";
import type { WorkoutSet } from "../../hooks/useWorkouts";
import { formatClock, parseClock } from "../../functions/formatDuration";
import { setLabels } from "../../functions/workoutSets";
import useDragAdjust from "../../hooks/useDragAdjust";
import ExerciseInput from "./ExerciseInput";
import { unitClass, unitFieldClass, unitInputClass } from "./SetForm";
import { boldFieldClass } from "../styles";

// An exercise as the checklist counts it: one ended early needs only the
// sets already done.
export type Step = SessionExercise & { planned_sets: number };

export const actionClass =
  "btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";

const optionClass =
  "btn rounded-full font-bold bg-base-content/8 border-0 shadow-none w-full";

// The rest taken before one set, typed or turned on the scroll wheel, saved
// shortly after it stops changing. Empty means no rest.
function RestField({
  set,
  label,
  onRest,
}: {
  set: WorkoutSet;
  label: string;
  onRest: (set: WorkoutSet, seconds: number | null) => void;
}) {
  const [text, setText] = useState(
    set.rest_seconds ? formatClock(set.rest_seconds) : "",
  );
  const drag = useDragAdjust({
    value: text,
    onChange: setText,
    label: `${label} · rest before`,
    min: 0,
    parse: parseClock,
    format: (n) => (n > 0 ? formatClock(n) : ""),
  });
  const seconds = parseClock(text);
  const invalid = text.trim() !== "" && seconds === null;
  // The latest change not yet saved, so closing the dialog doesn't drop it.
  const unsaved = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (invalid || seconds === set.rest_seconds) return;
    const save = () => {
      unsaved.current = null;
      onRest(set, seconds);
    };
    unsaved.current = save;
    const id = setTimeout(save, 600);
    return () => clearTimeout(id);
  }, [invalid, seconds, set, onRest]);
  useEffect(() => () => unsaved.current?.(), []);

  return (
    <div className="flex items-center gap-3">
      <span className="w-22 shrink-0 text-left text-xs font-semibold tracking-wide text-base-content/50 dark:text-base-content/75">
        {label}
      </span>
      <label
        className={`${unitFieldClass} ${invalid ? "ring-2 ring-error" : ""}`}
        {...drag.bind}
      >
        <input
          className={unitInputClass}
          inputMode="numeric"
          placeholder="0:00"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={`Rest before ${label.toLowerCase()}, in seconds or minutes:seconds`}
        />
        <span className={unitClass} aria-hidden>
          rest
        </span>
      </label>
      {drag.picker}
    </div>
  );
}

// The title of each exercise's card is its Options button. It opens a
// dialog to do the exercise now instead of the current one, swap it for
// another for this workout, end it before all its sets are done, or fix
// the rest taken before each of its sets.
export default function StepActions({
  step,
  titleClassName,
  sets,
  complete,
  suggestions,
  onPick,
  onSwap,
  onEnd,
  onRest,
}: {
  step: Step;
  titleClassName: string;
  // Its sets logged so far.
  sets: WorkoutSet[];
  complete: boolean;
  suggestions: string[];
  onPick?: () => void;
  onSwap: (name: string) => void;
  onEnd: (ended: boolean) => void;
  onRest: (set: WorkoutSet, seconds: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [name, setName] = useState("");

  const close = () => {
    setOpen(false);
    setSwapping(false);
    setName("");
  };
  // Each choice closes the dialog once it's made.
  const then = (run: () => void) => () => {
    run();
    close();
  };
  const swap = () => {
    if (!name.trim()) return;
    onSwap(name);
    close();
  };
  const labels = setLabels(sets, false);

  return (
    <>
      <button
        type="button"
        className={`${titleClassName} text-left cursor-pointer`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${step.name} options`}
      >
        {step.name}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/70 animate-fade-in p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          onClick={close}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${step.name} options`}
            className="w-full max-w-md max-h-[85svh] overflow-y-auto rounded-2xl bg-base-100 dark:bg-base-200 p-4 flex flex-col gap-3 shadow-xl ring-1 ring-base-content/10 animate-pop-in"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close()}
          >
            <p className="text-center text-xl font-extrabold tracking-tight">
              {step.name}
            </p>
            {swapping ? (
              <div className="flex flex-col gap-2">
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
                    className="btn btn-ghost rounded-full font-bold flex-1"
                    onClick={() => setSwapping(false)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary rounded-full font-bold flex-1"
                    onClick={swap}
                    disabled={!name.trim()}
                  >
                    Swap
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {onPick && (
                  <button
                    type="button"
                    className={optionClass}
                    onClick={then(onPick)}
                  >
                    Do this now
                  </button>
                )}
                <button
                  type="button"
                  className={optionClass}
                  onClick={() => setSwapping(true)}
                >
                  Swap exercise
                </button>
                {step.swapped_from && (
                  <button
                    type="button"
                    className={optionClass}
                    onClick={then(() => onSwap(step.swapped_from!))}
                  >
                    Back to {step.swapped_from}
                  </button>
                )}
                {step.ended ? (
                  <button
                    type="button"
                    className={optionClass}
                    onClick={then(() => onEnd(false))}
                  >
                    Pick back up
                  </button>
                ) : (
                  !complete && (
                    <button
                      type="button"
                      className={optionClass}
                      onClick={then(() => onEnd(true))}
                    >
                      End early
                    </button>
                  )
                )}
              </div>
            )}
            {!swapping && sets.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-base-content/10 pt-3">
                <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
                  Rest before each set
                </p>
                {sets.map((s, i) => (
                  <RestField
                    key={s.id}
                    set={s}
                    label={labels[i]}
                    onRest={onRest}
                  />
                ))}
              </div>
            )}
            {!swapping && (
              <button
                type="button"
                className="btn btn-ghost rounded-full font-bold"
                onClick={close}
                autoFocus
              >
                Done
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
