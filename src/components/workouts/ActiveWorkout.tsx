import { useEffect, useState } from "react";
import type { NewSet, Workout, WorkoutSet } from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import { formatClock } from "../../functions/formatDuration";
import SetForm from "./SetForm";
import SetList from "./SetList";

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";

// Re-renders every second while the stopwatch runs.
function useTick(running: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
}

interface ActiveWorkoutProps {
  workout: Workout;
  suggestions: string[];
  onPause: () => void;
  onResume: () => void;
  onFinish: (notes: string) => void;
  onDiscard: () => void;
  onAddSet: (set: NewSet) => void;
  onRemoveSet: (set: WorkoutSet) => void;
}

export default function ActiveWorkout({
  workout,
  suggestions,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onAddSet,
  onRemoveSet,
}: ActiveWorkoutProps) {
  const paused = workout.paused_at !== null;
  useTick(!paused);
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

      <section className={cardClass}>
        <h2 className="font-bold mb-3">Log a set</h2>
        <SetForm suggestions={suggestions} onAdd={onAddSet} />
      </section>

      {workout.workout_sets.length > 0 && (
        <section className={cardClass}>
          <SetList sets={workout.workout_sets} onRemove={onRemoveSet} />
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
