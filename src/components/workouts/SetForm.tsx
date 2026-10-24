import React, { useState } from "react";
import ExerciseInput from "./ExerciseInput";
import Chip from "../Chip";
import type { SetInput, Side } from "../../hooks/useWorkouts";
import { formatClock, parseClock } from "../../functions/formatDuration";
import { WEIGHT_UNIT } from "../../functions/workoutSets";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45";

const text = (n: number | null | undefined) => (n == null ? "" : String(n));

interface SetFormProps {
  // Exercise names used before, most recent first.
  suggestions: string[];
  // Prefills the fields, e.g. from the plan, the set timer or the set being
  // edited.
  initial?: Partial<SetInput>;
  submitLabel?: string;
  onCancel?: () => void;
  onAdd: (set: SetInput) => void;
}

export default function SetForm({
  suggestions,
  initial,
  submitLabel = "Add set",
  onCancel,
  onAdd,
}: SetFormProps) {
  const [exercise, setExercise] = useState(initial?.exercise_name ?? "");
  const [reps, setReps] = useState(text(initial?.reps));
  const [weight, setWeight] = useState(text(initial?.weight));
  const [time, setTime] = useState(
    initial?.duration_seconds ? formatClock(initial.duration_seconds) : "",
  );
  // Only one-side-at-a-time sets have a side, and it can be corrected here.
  const [side, setSide] = useState<Side | null>(initial?.side ?? null);

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

  // The fields keep their values afterwards, so the next set of the same
  // exercise is one tap away.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    onAdd({
      exercise_name: exercise.trim(),
      reps: parsedReps,
      weight: parsedWeight,
      duration_seconds: parsedTime,
      side,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <ExerciseInput
        className={fieldClass}
        value={exercise}
        onChange={setExercise}
        suggestions={suggestions}
      />
      {side && (
        <div className="flex gap-1.5" aria-label="Side">
          {(["left", "right"] as const).map((s) => (
            <Chip key={s} selected={side === s} onClick={() => setSide(s)}>
              {s === "left" ? "Left" : "Right"}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          className={fieldClass}
          inputMode="numeric"
          placeholder="Reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          aria-label="Reps"
        />
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder={WEIGHT_UNIT}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          aria-label={`Weight in ${WEIGHT_UNIT}`}
        />
        <input
          className={fieldClass}
          inputMode="numeric"
          placeholder="Time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Time, in seconds or minutes:seconds"
        />
      </div>
      {invalid && (
        <p className="text-sm font-semibold text-error">
          Use whole reps, a weight like 22.5, and time like 45 or 1:30.
        </p>
      )}
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
    </form>
  );
}
