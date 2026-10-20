import React, { useState } from "react";
import type { NewSet } from "../../hooks/useWorkouts";
import { parseClock } from "../../functions/formatDuration";
import { WEIGHT_UNIT } from "../../functions/workoutSets";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45";

interface SetFormProps {
  // Exercise names used before, most recent first.
  suggestions: string[];
  onAdd: (set: NewSet) => void;
}

export default function SetForm({ suggestions, onAdd }: SetFormProps) {
  const [exercise, setExercise] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [time, setTime] = useState("");

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
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        className={fieldClass}
        list="exercise-suggestions"
        placeholder="Exercise, like Goblet squat"
        value={exercise}
        onChange={(e) => setExercise(e.target.value)}
        aria-label="Exercise"
        autoCapitalize="words"
      />
      <datalist id="exercise-suggestions">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
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
      <button
        type="submit"
        className="btn btn-primary rounded-full font-bold active:scale-[0.98] transition"
        disabled={!canAdd}
      >
        Add set
      </button>
    </form>
  );
}
