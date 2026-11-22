import type { FormEvent } from "react";
import Chip from "../Chip";
import useDraft, { clearDraft } from "../../hooks/useDraft";
import useDragAdjust from "../../hooks/useDragAdjust";
import type { ActivityInput, Workout } from "../../hooks/useWorkouts";
import {
  activityTimes,
  localDate,
  localTime,
} from "../../functions/activities";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import { boldFieldClass, fieldClass } from "../styles";
import { unitClass, unitFieldClass, unitInputClass } from "./SetForm";

const labelClass =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

interface ActivityFormProps {
  // The logged workout being changed; a new one when left out.
  workout?: Workout;
  choices: string[];
  onSave: (input: ActivityInput) => Promise<boolean>;
  onCancel: () => void;
}

// Logs a workout that isn't sets of exercises, like yoga: what it was, when
// it ended, how long it took, and a description.
export default function ActivityForm({
  workout,
  choices,
  onSave,
  onCancel,
}: ActivityFormProps) {
  const scope = workout ? `activity:${workout.id}` : "activity";
  const ended = workout?.ended_at ? new Date(workout.ended_at) : new Date();
  const [activity, setActivity] = useDraft(
    scope,
    "activity",
    workout?.activity ?? "",
  );
  const [date, setDate] = useDraft(scope, "date", () => localDate(ended));
  const [time, setTime] = useDraft(scope, "time", () => localTime(ended));
  const [minutes, setMinutes] = useDraft(scope, "minutes", () =>
    workout ? String(Math.round(elapsedSeconds(workout) / 60)) : "30",
  );
  const [notes, setNotes] = useDraft(scope, "notes", workout?.notes ?? "");
  const drag = useDragAdjust({
    value: minutes,
    onChange: setMinutes,
    label: "Minutes",
    min: 1,
  });

  const mins = Number(minutes);
  const validMinutes = Number.isInteger(mins) && mins > 0;
  const times = validMinutes ? activityTimes(date, time, mins) : null;
  const canSave = activity.trim() !== "" && times !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const saved = await onSave({
      activity: activity.trim(),
      ...times,
      notes: notes.trim() || null,
    });
    if (saved) clearDraft(scope);
  };

  const cancel = () => {
    clearDraft(scope);
    onCancel();
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl bg-base-content/5 dark:bg-base-content/9 p-4 sm:p-5 animate-expand-in"
      aria-label={workout ? "Edit workout" : "Log another workout"}
    >
      <p className="text-lg font-bold">
        {workout ? "Edit workout" : "Log another workout"}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>What you did</span>
        <input
          className={boldFieldClass}
          placeholder="Yoga, a run, climbing…"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          maxLength={100}
        />
      </label>
      <div className="flex flex-wrap gap-1.5" aria-label="Pick one">
        {choices.map((c) => (
          <Chip
            key={c}
            selected={activity.trim().toLowerCase() === c.toLowerCase()}
            onClick={() => setActivity(c)}
          >
            {c}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Date</span>
          <input
            type="date"
            className={`${fieldClass} font-semibold`}
            value={date}
            max={localDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Finished at</span>
          <input
            type="time"
            className={`${fieldClass} font-semibold`}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>How long</span>
        <label
          className={`${unitFieldClass} max-w-40 ${validMinutes ? "" : "ring-2 ring-error"}`}
          {...drag.bind}
        >
          <input
            className={unitInputClass}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="How long, in minutes"
          />
          <span className={unitClass}>min</span>
        </label>
        {drag.picker}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Description</span>
        <textarea
          className={`${fieldClass} min-h-24`}
          placeholder="Flow, poses, how it felt…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold"
          onClick={cancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary rounded-full font-bold px-6"
          disabled={!canSave}
        >
          Save
        </button>
      </div>
    </form>
  );
}
