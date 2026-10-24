import { useState } from "react";
import type { SetInput, Workout, WorkoutSet } from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import { formatDuration } from "../../functions/formatDuration";
import SetList from "./SetList";
import { groupSets } from "../../functions/workoutSets";

function formatDay(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

interface WorkoutHistoryCardProps {
  workout: Workout;
  suggestions?: string[];
  onUpdateSet?: (set: WorkoutSet, changes: SetInput) => void;
  onDelete: () => void;
}

export default function WorkoutHistoryCard({
  workout,
  suggestions,
  onUpdateSet,
  onDelete,
}: WorkoutHistoryCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const groups = groupSets(workout.workout_sets);
  const setCount = workout.workout_sets.length;

  return (
    <div className="rounded-2xl bg-base-content/5 dark:bg-base-content/9">
      <button
        type="button"
        className="w-full text-left px-4 py-3 sm:px-5 sm:py-4 cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-3">
          <time
            dateTime={workout.started_at}
            className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70"
          >
            {formatDay(workout.started_at)}
          </time>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-base-content/40 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <p className="mt-1 text-lg font-bold">
          {formatDuration(elapsedSeconds(workout))}
          <span className="font-semibold text-base-content/55 dark:text-base-content/70">
            {" "}
            · {setCount} {setCount === 1 ? "set" : "sets"}
          </span>
        </p>
        {groups.length > 0 && !open && (
          <p className="mt-0.5 text-sm font-medium text-base-content/70 dark:text-base-content/80 truncate">
            {groups.map((g) => g.name).join(", ")}
          </p>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 sm:px-5 flex flex-col gap-4">
          {workout.notes && (
            <p className="whitespace-pre-wrap font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)]">
              {workout.notes}
            </p>
          )}
          {setCount > 0 ? (
            <SetList
              sets={workout.workout_sets}
              suggestions={suggestions}
              onUpdate={onUpdateSet}
            />
          ) : (
            <p className="text-sm font-medium text-base-content/55">
              No sets logged.
            </p>
          )}
          <div className="flex justify-end gap-2">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost rounded-full font-bold"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-error rounded-full font-bold"
                  onClick={onDelete}
                >
                  Delete workout
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
