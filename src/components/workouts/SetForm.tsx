import React, { useEffect, useRef, useState } from "react";
import ExerciseInput from "./ExerciseInput";
import Chip from "../Chip";
import type { SetInput, Side } from "../../hooks/useWorkouts";
import { formatClock, parseClock } from "../../functions/formatDuration";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import useDragAdjust from "../../hooks/useDragAdjust";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45 dark:placeholder:text-base-content/65";

// A field that reads like "10 reps": the number sits right up against its
// unit. Tapping anywhere in the box focuses the input, and dragging up or down
// on it turns a scroll wheel of values instead of scrolling the page.
const unitFieldClass =
  "flex flex-1 min-w-0 items-baseline gap-1 rounded-xl bg-base-content/8 px-3 py-2.5 transition focus-within:bg-base-content/12 cursor-ns-resize touch-none";
const unitInputClass =
  "w-full min-w-0 bg-transparent text-right font-semibold outline-none";
const unitClass =
  "shrink-0 text-sm font-medium text-base-content/45 dark:text-base-content/65";

const weightLabel = WEIGHT_UNIT === "lb" ? "lbs" : WEIGHT_UNIT;

const text = (n: number | null | undefined) => (n == null ? "" : String(n));

interface SetFormProps {
  // Exercise names used before, most recent first.
  suggestions: string[];
  // Prefills the fields, e.g. from the plan, the set timer or the set being
  // edited.
  initial?: Partial<SetInput>;
  // Whether an exercise is done one side at a time, to offer Left / Right.
  isUnilateral?: (exercise: string) => boolean;
  submitLabel?: string;
  // The exercise is shown above already (the set timer), so no field for it.
  hideExercise?: boolean;
  // The time is the set timer's big clock, made editable, in place of the
  // small time box; aboveFields goes between it and the rest of the form.
  bigTime?: boolean;
  aboveFields?: React.ReactNode;
  onCancel?: () => void;
  // Editing a logged set: turn it into two, halving its time.
  onSplit?: () => void;
  // Editing a logged set: delete it, or every set of its exercise.
  onDelete?: () => void;
  onDeleteExercise?: { label: string; run: () => void };
  onAdd?: (set: SetInput) => void;
  // Instead of a button to save: each change saves on its own, shortly
  // after you stop typing or dragging.
  onChange?: (set: SetInput) => void;
}

export default function SetForm({
  suggestions,
  initial,
  isUnilateral,
  submitLabel = "Add set",
  hideExercise,
  bigTime,
  aboveFields,
  onCancel,
  onSplit,
  onDelete,
  onDeleteExercise,
  onAdd,
  onChange,
}: SetFormProps) {
  const [exercise, setExercise] = useState(initial?.exercise_name ?? "");
  const [reps, setReps] = useState(text(initial?.reps));
  const [weight, setWeight] = useState(text(initial?.weight));
  const dragReps = useDragAdjust({
    value: reps,
    onChange: setReps,
    label: "Reps",
    min: 1,
  });
  const dragWeight = useDragAdjust({
    value: weight,
    onChange: setWeight,
    label: `Weight (${weightLabel})`,
    min: 0,
  });
  const [time, setTime] = useState(
    initial?.duration_seconds ? formatClock(initial.duration_seconds) : "",
  );
  const dragTime = useDragAdjust({
    value: time,
    onChange: setTime,
    label: "Time",
    min: 0,
    parse: parseClock,
    format: (n) => (n > 0 ? formatClock(n) : ""),
  });
  // One-side-at-a-time sets say which side; tapping the chosen side again
  // clears it.
  const [side, setSide] = useState<Side | null>(initial?.side ?? null);
  const showSide = side !== null || (isUnilateral?.(exercise) ?? false);

  const parsedReps = /^\s*[1-9]\d*\s*$/.test(reps) ? Number(reps) : null;
  const parsedWeight = /^\s*\d+(\.\d+)?\s*$/.test(weight)
    ? Number(weight)
    : null;
  const parsedTime = parseClock(time);
  const invalid =
    (reps.trim() !== "" && parsedReps === null) ||
    (weight.trim() !== "" && parsedWeight === null) ||
    (time.trim() !== "" && parsedTime === null);
  const canAdd =
    exercise.trim() !== "" &&
    !invalid &&
    (parsedReps !== null || parsedWeight !== null || parsedTime !== null);

  const values: SetInput = {
    exercise_name: exercise.trim(),
    reps: parsedReps,
    weight: parsedWeight,
    duration_seconds: parsedTime,
    side,
  };
  const key = JSON.stringify(values);
  const saved = useRef(key);
  // The latest change not yet saved, so closing the form doesn't drop it.
  const unsaved = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!onChange || !canAdd || key === saved.current) return;
    const save = () => {
      unsaved.current = null;
      saved.current = key;
      onChange(JSON.parse(key));
    };
    unsaved.current = save;
    const id = setTimeout(save, 600);
    return () => clearTimeout(id);
  }, [onChange, canAdd, key]);
  useEffect(() => () => unsaved.current?.(), []);

  // The fields keep their values afterwards, so the next set of the same
  // exercise is one tap away.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    onAdd?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {bigTime && (
        <label
          className="self-center my-1 rounded-2xl bg-base-content/6 px-4 py-1 transition focus-within:bg-base-content/12 cursor-ns-resize touch-none"
          {...dragTime.bind}
        >
          <input
            className="w-32 bg-transparent text-center text-3xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-base-content/30"
            inputMode="numeric"
            placeholder="0:00"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Time, in seconds or minutes:seconds"
          />
        </label>
      )}
      {aboveFields}
      {!hideExercise && (
        <ExerciseInput
          className={fieldClass}
          value={exercise}
          onChange={setExercise}
          suggestions={suggestions}
        />
      )}
      {showSide && (
        <div className="flex gap-1.5" role="group" aria-label="Side">
          {(["right", "left"] as const).map((s) => (
            <Chip
              key={s}
              selected={side === s}
              onClick={() => setSide(side === s ? null : s)}
            >
              {s === "left" ? "Left" : "Right"}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className={unitFieldClass} {...dragReps.bind}>
          <input
            className={unitInputClass}
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            aria-label="Reps"
          />
          <span className={unitClass} aria-hidden>
            reps
          </span>
        </label>
        <span
          className="text-base font-semibold text-base-content/45 dark:text-base-content/65"
          aria-hidden
        >
          ×
        </span>
        <label className={unitFieldClass} {...dragWeight.bind}>
          <input
            className={unitInputClass}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-label={`Weight in ${WEIGHT_UNIT}`}
          />
          <span className={unitClass} aria-hidden>
            {weightLabel}
          </span>
        </label>
        {!bigTime && (
          <input
            className={`${fieldClass} flex-1`}
            inputMode="numeric"
            placeholder="Time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Time, in seconds or minutes:seconds"
          />
        )}
      </div>
      {invalid && (
        <p className="text-sm font-semibold text-error">
          Use whole reps, a weight like 22.5, and time like 45 or 1:30.
        </p>
      )}
      {onAdd && (
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              className="btn btn-ghost rounded-full font-bold flex-1"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary rounded-full font-bold flex-1 active:scale-[0.98] transition"
            disabled={!canAdd}
          >
            {submitLabel}
          </button>
        </div>
      )}
      {onSplit && (
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/60 dark:text-base-content/75 self-center"
          onClick={onSplit}
        >
          Split into two sets
          {initial?.duration_seconds != null &&
            initial.duration_seconds >= 2 &&
            ` of ${formatClock(Math.ceil(initial.duration_seconds / 2))}`}
        </button>
      )}
      {(onDelete || onDeleteExercise) && (
        <div className="flex flex-wrap justify-center gap-1">
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-semibold text-error"
              onClick={onDelete}
            >
              Delete set
            </button>
          )}
          {onDeleteExercise && (
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-semibold text-error"
              onClick={onDeleteExercise.run}
            >
              {onDeleteExercise.label}
            </button>
          )}
        </div>
      )}
      {dragTime.picker}
      {dragReps.picker}
      {dragWeight.picker}
    </form>
  );
}
