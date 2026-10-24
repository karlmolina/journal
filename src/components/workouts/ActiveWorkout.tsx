import { useEffect, useState } from "react";
import type { SetInput, Workout, WorkoutSet } from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import type { PlannedSession } from "../../hooks/useWorkoutPlans";
import useTick from "../../hooks/useTick";
import { formatClock } from "../../functions/formatDuration";
import {
  currentExerciseIndex,
  describeTarget,
  nextSide,
  setsDone,
  sideLabel,
} from "../../functions/planProgress";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import SetList from "./SetList";
import SetTimer from "./SetTimer";

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";

// Rest between sets when the plan doesn't say.
const DEFAULT_REST = 90;

export interface PlannedWorkout {
  planTitle: string;
  session: PlannedSession;
}

interface ActiveWorkoutProps {
  workout: Workout;
  planned?: PlannedWorkout;
  suggestions: string[];
  timerKey: string;
  prefillFor: (exercise: string) => Partial<SetInput>;
  // Whether an exercise is done one side at a time.
  isUnilateral: (exercise: string) => boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: (notes: string) => void;
  onDiscard: () => void;
  initialExercise?: string;
  onAddSet: (set: SetInput) => void;
  onUpdateSet: (set: WorkoutSet, changes: SetInput) => void;
  onRemoveSet: (set: WorkoutSet) => void;
}

function PlanChecklist({
  session,
  sets,
  selected,
  onSelect,
}: {
  session: PlannedSession;
  sets: WorkoutSet[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  return (
    <ol className="mt-2 flex flex-col gap-1">
      {session.exercises.map((e, i) => {
        const done = setsDone(e, sets);
        const complete = done >= e.sets;
        return (
          <li key={i}>
            <button
              type="button"
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                selected === i ? "bg-primary/15" : "hover:bg-base-content/6"
              }`}
              onClick={() => onSelect(i)}
              aria-pressed={selected === i}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  complete
                    ? "bg-primary text-primary-content"
                    : "bg-base-content/10 text-base-content/60"
                }`}
                aria-hidden="true"
              >
                {complete ? "✓" : i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={`block font-bold truncate ${complete ? "text-base-content/50 line-through" : ""}`}
                >
                  {e.name}
                </span>
                <span className="block text-xs font-semibold text-base-content/55 tabular-nums">
                  {describeTarget(e)}
                  {e.rest_seconds > 0 && ` · rest ${e.rest_seconds}s`}
                </span>
              </span>
              <span className="text-sm font-bold tabular-nums text-base-content/60">
                {Math.min(done, e.sets)}/{e.sets}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default function ActiveWorkout({
  workout,
  planned,
  suggestions,
  timerKey,
  prefillFor,
  isUnilateral,
  initialExercise,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
}: ActiveWorkoutProps) {
  const paused = workout.paused_at !== null;
  useTick(!paused);
  const sets = workout.workout_sets;
  const exercises = planned?.session.exercises ?? [];
  // The exercise picked in the checklist; otherwise the first unfinished one.
  const [picked, setPicked] = useState<number | null>(null);
  const auto = currentExerciseIndex(exercises, sets);
  const selectedIndex = picked ?? auto;
  const selected =
    selectedIndex !== null ? exercises[selectedIndex] : undefined;
  const target =
    selected &&
    [
      `Set ${Math.min(setsDone(selected, sets) + 1, selected.sets)} of ${selected.sets}`,
      selected.unilateral && sideLabel(nextSide(selected.name, sets)),
      `${selected.reps}${selected.weight != null ? ` at ${selected.weight} ${WEIGHT_UNIT}` : ""}`,
    ]
      .filter(Boolean)
      .join(" · ");

  // One-side-at-a-time exercises alternate, starting with the left.
  const sideFor = (name: string) =>
    name.trim() && isUnilateral(name) ? nextSide(name, sets) : null;

  const restFor = (name: string) => {
    const e = exercises.find(
      (x) => x.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return e ? e.rest_seconds : DEFAULT_REST;
  };

  const handleSave = (set: SetInput) => {
    onAddSet(set);
    // Once the picked exercise has all its sets, go back to following the plan.
    if (
      selected &&
      set.exercise_name.toLowerCase() === selected.name.toLowerCase() &&
      setsDone(selected, [...sets, set as WorkoutSet]) >= selected.sets
    )
      setPicked(null);
  };
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [notes, setNotes] = useState("");
  const elapsed = formatClock(elapsedSeconds(workout));

  // Show the running time in the browser tab too.
  useEffect(() => {
    const previous = document.title;
    document.title = `${elapsed} · Workout`;
    return () => {
      document.title = previous;
    };
  }, [elapsed]);

  const started = new Date(workout.started_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-3">
      <section
        className={`${cardClass} flex flex-col items-center text-center`}
      >
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70">
          {paused ? "Paused" : "In progress"} · started {started}
        </p>
        <p
          className={`my-2 text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums transition-opacity ${
            paused ? "opacity-50" : ""
          }`}
          role="timer"
          aria-live="off"
        >
          {elapsed}
        </p>

        {finishing ? (
          <div className="w-full flex flex-col gap-2 mt-1">
            <textarea
              className="w-full resize-none rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45 text-left"
              rows={2}
              placeholder="How did it go? (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost rounded-full font-bold flex-1"
                onClick={() => setFinishing(false)}
              >
                Keep going
              </button>
              <button
                type="button"
                className="btn btn-primary rounded-full font-bold flex-1"
                onClick={() => onFinish(notes)}
              >
                Save workout
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 w-full mt-1">
            <button
              type="button"
              className="btn rounded-full font-bold flex-1 bg-base-content/8 border-0 shadow-none"
              onClick={paused ? onResume : onPause}
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className="btn btn-primary rounded-full font-bold flex-1"
              onClick={() => setFinishing(true)}
            >
              Finish
            </button>
          </div>
        )}
      </section>

      {planned && (
        <section className={cardClass}>
          <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70">
            {planned.planTitle} · {planned.session.day}
          </p>
          <h2 className="font-bold">{planned.session.focus}</h2>
          <PlanChecklist
            session={planned.session}
            sets={sets}
            selected={selectedIndex}
            onSelect={setPicked}
          />
          {auto === null && exercises.length > 0 && (
            <p className="mt-2 text-sm font-bold text-center text-primary">
              Every planned set is done. Nice work.
            </p>
          )}
        </section>
      )}

      <section className={cardClass}>
        <SetTimer
          workoutId={workout.id}
          storageKey={timerKey}
          exercise={selected?.name ?? initialExercise ?? ""}
          target={target || undefined}
          notes={
            [selected?.notes, selected?.goal && `Goal ${selected.goal}`]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          suggestions={suggestions}
          prefillFor={prefillFor}
          restFor={restFor}
          sideFor={sideFor}
          onSave={handleSave}
        />
      </section>

      {sets.length > 0 && (
        <section className={cardClass}>
          <SetList
            sets={sets}
            suggestions={suggestions}
            onUpdate={onUpdateSet}
            onRemove={onRemoveSet}
          />
        </section>
      )}

      <div className="flex justify-center pb-6">
        {confirmDiscard ? (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-base-content/60">Delete this workout?</span>
            <button
              type="button"
              className="btn btn-sm btn-error rounded-full font-bold"
              onClick={onDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost rounded-full font-bold"
              onClick={() => setConfirmDiscard(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard workout
          </button>
        )}
      </div>
    </div>
  );
}
