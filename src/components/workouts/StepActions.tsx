import { useEffect, useRef, useState } from "react";
import type { SessionExercise } from "../../functions/planProgress";
import type { WorkoutSet } from "../../hooks/useWorkouts";
import { formatClock, parseClock } from "../../functions/formatDuration";
import { setLabels } from "../../functions/workoutSets";
import useDragAdjust from "../../hooks/useDragAdjust";
import ExerciseInput from "./ExerciseInput";
import { AddNoteForm, type ExerciseNotesProps } from "./ExerciseNote";
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
// another for this workout (the swap field sits right in the dialog), add a
// note on it, end
// it before all its sets are done, switch it between one side at a time
// and both sides at once, or fix the rest taken before each of its sets.
export default function StepActions({
  step,
  titleClassName,
  sets,
  complete,
  suggestions,
  onPick,
  stopping,
  running = false,
  onSwap,
  onEnd,
  onSides,
  onRest,
  exerciseNotes,
  regions = [],
}: {
  step: Step;
  titleClassName: string;
  // Its sets logged so far.
  sets: WorkoutSet[];
  complete: boolean;
  suggestions: string[];
  onPick?: () => void;
  // The exercise whose set is going, which Do this now stops unsaved.
  stopping?: string;
  // Its own set is going: swapping carries the set on as the new exercise,
  // and ending it or its sides wait until the set is done.
  running?: boolean;
  onSwap: (name: string) => void;
  onEnd: (ended: boolean) => void;
  // Does it one side at a time (true) or both sides at once, this workout.
  onSides: (unilateral: boolean) => void;
  onRest: (set: WorkoutSet, seconds: number | null) => void;
  // To add a note on it, and its body regions to suggest an injury.
  exerciseNotes?: ExerciseNotesProps;
  regions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // The note form is open in the dialog. Its text is a draft, kept if the
  // dialog closes before Save.
  const [noting, setNoting] = useState(false);

  const close = () => {
    setOpen(false);
    setName("");
    setNoting(false);
  };
  // Each choice closes the dialog once it's made.
  const then = (run: () => void) => () => {
    run();
    close();
  };
  const swap = (to = name) => {
    if (!to.trim()) return;
    onSwap(to);
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
            <div className="flex flex-col gap-2">
              {onPick && stopping && (
                <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 px-1 text-center">
                  Your {stopping} set stops without saving.
                </p>
              )}
              {onPick && (
                <button
                  type="button"
                  className={optionClass}
                  onClick={then(onPick)}
                >
                  Do this now
                </button>
              )}
              {/* Swap right here: tap a suggestion, or type a name and Swap. */}
              <form
                className="flex flex-col gap-2 rounded-2xl bg-base-content/5 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  swap();
                }}
              >
                <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75 px-1">
                  Swap for another exercise, just this workout
                  {running && ". The set going carries on as it"}
                </p>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <ExerciseInput
                      className={boldFieldClass}
                      value={name}
                      onChange={setName}
                      placeholder="Swap for…"
                      // Tapping a suggestion swaps to it straight away.
                      onPick={swap}
                      suggestions={suggestions.filter(
                        (n) => n.toLowerCase() !== step.name.toLowerCase(),
                      )}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-full font-bold"
                    disabled={!name.trim()}
                  >
                    Swap
                  </button>
                </div>
              </form>
              {exerciseNotes &&
                (noting ? (
                  <div className="flex flex-col gap-2 rounded-2xl bg-base-content/5 p-3">
                    <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75 px-1">
                      Note on {step.name}
                    </p>
                    <AddNoteForm
                      exercise={step.name}
                      regions={regions}
                      {...exerciseNotes}
                      onDone={(saved) => (saved ? close() : setNoting(false))}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className={optionClass}
                    onClick={() => setNoting(true)}
                  >
                    Add a note
                  </button>
                ))}
              {step.swapped_from && (
                <button
                  type="button"
                  className={optionClass}
                  onClick={then(() => onSwap(step.swapped_from!))}
                >
                  Back to {step.swapped_from}
                </button>
              )}
              {!running && (step.unilateral || step.sides_changed) && (
                <button
                  type="button"
                  className={optionClass}
                  onClick={then(() => onSides(!step.unilateral))}
                >
                  {step.unilateral
                    ? "Both sides at once"
                    : "Back to one side at a time"}
                </button>
              )}
              {running ? null : step.ended ? (
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
            {sets.length > 0 && (
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
            <button
              type="button"
              className="btn btn-ghost rounded-full font-bold"
              onClick={close}
              autoFocus
            >
              Done
            </button>
          </section>
        </div>
      )}
    </>
  );
}
