import { useState } from "react";
import type { SetInput, Workout, WorkoutSet } from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import { formatDuration } from "../../functions/formatDuration";
import SetList from "./SetList";
import {
  bodyPartLabel,
  bodyPartScores,
  scoreLevel,
} from "../../functions/bodyPartScores";
import {
  WEIGHT_UNIT,
  groupSets,
  setCount as countSets,
  totalVolume,
} from "../../functions/workoutSets";
import type { Supersets } from "../../functions/supersets";

function formatDay(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

// "A", "B", … for each superset, keyed by lowercased exercise name.
function supersetLetters(groups: Supersets) {
  const tags = new Map<string, string>();
  groups.forEach((g, i) =>
    g.forEach((name) =>
      tags.set(name.trim().toLowerCase(), String.fromCharCode(65 + i)),
    ),
  );
  return tags;
}

// Five bars filled by how hard a body part was hit, then the score itself
// (sets, where a set of a secondary body part counts half).
function ScoreMeter({ score }: { score: number }) {
  const level = scoreLevel(score);
  const shown = Number.isInteger(score) ? score : score.toFixed(1);
  return (
    <span
      className="shrink-0 flex items-center gap-1.5"
      aria-label={`${shown} sets, ${level} of 5`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-1.5 rounded-full ${i <= level ? "bg-primary dark:bg-[color-mix(in_oklab,var(--color-primary),white_35%)]" : "bg-base-content/12 dark:bg-base-content/20"}`}
          />
        ))}
      </span>
      <span
        className="w-6 text-right text-xs font-semibold tabular-nums text-base-content/55 dark:text-base-content/75"
        aria-hidden="true"
      >
        {shown}
      </span>
    </span>
  );
}

interface WorkoutHistoryCardProps {
  workout: Workout;
  // The supersets this workout used, from the workout or its plan.
  supersets?: Supersets;
  // The body parts an exercise works, main one first.
  bodyPartsOf?: (exerciseName: string) => string[];
  suggestions?: string[];
  onUpdateSet?: (set: WorkoutSet, changes: SetInput) => void;
  onDelete: () => void;
}

export default function WorkoutHistoryCard({
  workout,
  supersets = [],
  bodyPartsOf = () => [],
  suggestions,
  onUpdateSet,
  onDelete,
}: WorkoutHistoryCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const groups = groupSets(workout.workout_sets);
  const setCount = groups.reduce((n, g) => n + countSets(g.sets), 0);
  const volume = totalVolume(workout.workout_sets);
  const tags = supersetLetters(supersets);
  const parts = bodyPartScores(workout.workout_sets, bodyPartsOf);
  const muted = "text-base-content/55 dark:text-base-content/75";

  return (
    <div className="rounded-2xl bg-base-content/5 dark:bg-base-content/9">
      <button
        type="button"
        className="w-full text-left px-4 py-3 sm:px-5 cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <p className="flex-1 min-w-0 truncate text-sm">
            <time dateTime={workout.started_at} className="font-bold">
              {formatDay(workout.started_at)}
            </time>
            <span className={`font-semibold tabular-nums ${muted}`}>
              {" "}
              · {formatDuration(elapsedSeconds(workout))} · {setCount}{" "}
              {setCount === 1 ? "set" : "sets"}
            </span>
          </p>
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
            className={`shrink-0 text-base-content/40 dark:text-base-content/70 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {!open && parts.length > 0 && (
          <ul
            className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm"
            aria-label="Body parts worked"
          >
            {parts.map(({ part, score }) => (
              <li key={part} className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0 truncate font-semibold text-base-content/85 dark:text-[color-mix(in_oklab,var(--color-base-content),white_30%)]">
                  {bodyPartLabel(part)}
                </span>
                <ScoreMeter score={score} />
              </li>
            ))}
          </ul>
        )}
        {!open && workout.notes && (
          <p className={`mt-1.5 text-sm font-medium truncate ${muted}`}>
            {workout.notes}
          </p>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 sm:px-5 flex flex-col gap-3">
          {workout.notes && (
            <p className="whitespace-pre-wrap text-sm font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)]">
              {workout.notes}
            </p>
          )}
          {setCount > 0 ? (
            <SetList
              sets={workout.workout_sets}
              suggestions={suggestions}
              onUpdate={onUpdateSet}
              dense
              supersetTags={tags}
            />
          ) : (
            <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
              No sets logged.
            </p>
          )}
          <div className="flex items-center justify-end gap-2 -mb-1">
            {volume > 0 && (
              <p
                className={`mr-auto text-xs font-semibold tabular-nums ${muted}`}
              >
                {Math.round(volume).toLocaleString("en-US")} {WEIGHT_UNIT} total
                volume
              </p>
            )}
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
                className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55 dark:text-base-content/75"
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
