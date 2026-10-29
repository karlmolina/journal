import type React from "react";
import { useState } from "react";
import ExerciseInput from "./ExerciseInput";
import type { PlannedExercise } from "../../hooks/useWorkoutPlans";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import useDragAdjust from "../../hooks/useDragAdjust";
import { boldFieldClass } from "../styles";

// Reads like "3 sets": the number sits right up against its unit, and dragging
// on the box turns a scroll wheel of values.
const unitFieldClass =
  "flex flex-1 min-w-0 items-baseline gap-1 rounded-xl bg-base-content/8 px-3 py-2.5 transition focus-within:bg-base-content/12 cursor-ns-resize touch-none";
const unitInputClass =
  "w-full min-w-0 bg-transparent text-right font-semibold outline-none";
const unitClass =
  "shrink-0 text-sm font-medium text-base-content/45 dark:text-base-content/65";

const weightLabel = WEIGHT_UNIT === "lb" ? "lbs" : WEIGHT_UNIT;

// A form for one more exercise at the end of a plan day or a workout: pick
// one from the library or type a new name, with its sets, reps or time, rest
// and weight.
export default function AddPlanExercise({
  submitLabel,
  above,
  suggestions,
  onAdd,
  onCancel,
}: {
  // Like "Add to Day 2".
  submitLabel: string;
  // Shown over the fields, like a choice of where it goes.
  above?: React.ReactNode;
  // Exercise names, most recent first.
  suggestions: string[];
  onAdd: (exercise: PlannedExercise) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [rest, setRest] = useState("60");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const dragSets = useDragAdjust({
    value: sets,
    onChange: setSets,
    label: "Sets",
    min: 1,
  });
  const dragRest = useDragAdjust({
    value: rest,
    onChange: setRest,
    label: "Rest (seconds)",
    min: 0,
  });
  const dragWeight = useDragAdjust({
    value: weight,
    onChange: setWeight,
    label: `Weight (${weightLabel})`,
    min: 0,
  });

  const parsedSets = /^\s*[1-9]\d*\s*$/.test(sets) ? Number(sets) : null;
  const parsedRest = /^\s*\d+\s*$/.test(rest) ? Number(rest) : null;
  const parsedWeight = /^\s*\d+(\.\d+)?\s*$/.test(weight)
    ? Number(weight)
    : null;
  const invalid =
    parsedSets === null ||
    parsedRest === null ||
    (weight.trim() !== "" && parsedWeight === null);
  const canAdd = name.trim() !== "" && reps.trim() !== "" && !invalid;

  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-base-content/5 p-3 animate-expand-in"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canAdd || saving) return;
        setSaving(true);
        const ok = await onAdd({
          name: name.trim(),
          sets: parsedSets!,
          reps: reps.trim(),
          rest_seconds: parsedRest!,
          notes: notes.trim(),
          weight: parsedWeight,
        });
        setSaving(false);
        if (ok) onCancel();
      }}
    >
      {above}
      <ExerciseInput
        className={boldFieldClass}
        value={name}
        onChange={setName}
        suggestions={suggestions}
      />
      <div className="flex items-center gap-2">
        <label className={unitFieldClass} {...dragSets.bind}>
          <input
            className={unitInputClass}
            inputMode="numeric"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            aria-label="Sets"
          />
          <span className={unitClass} aria-hidden>
            sets
          </span>
        </label>
        <span
          className="text-base font-semibold text-base-content/45 dark:text-base-content/65"
          aria-hidden
        >
          ×
        </span>
        <input
          className={`${boldFieldClass} flex-1`}
          placeholder="8-10 or 30 sec"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          aria-label="Reps or time per set"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className={unitFieldClass} {...dragRest.bind}>
          <input
            className={unitInputClass}
            inputMode="numeric"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            aria-label="Rest in seconds"
          />
          <span className={unitClass} aria-hidden>
            s rest
          </span>
        </label>
        <label className={unitFieldClass} {...dragWeight.bind}>
          <input
            className={unitInputClass}
            inputMode="decimal"
            placeholder="—"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-label={`Weight in ${WEIGHT_UNIT} (optional)`}
          />
          <span className={unitClass} aria-hidden>
            {weightLabel}
          </span>
        </label>
      </div>
      <input
        className={boldFieldClass}
        placeholder="Notes, like form cues (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        aria-label="Notes"
      />
      {invalid && (
        <p className="text-sm font-semibold text-error">
          Use whole sets and seconds, and a weight like 22.5.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold flex-1"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary rounded-full font-bold flex-1 active:scale-[0.98] transition"
          disabled={!canAdd || saving}
        >
          {submitLabel}
        </button>
      </div>
      {dragSets.picker}
      {dragRest.picker}
      {dragWeight.picker}
    </form>
  );
}
