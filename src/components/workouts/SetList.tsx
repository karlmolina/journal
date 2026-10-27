import { useState } from "react";
import { Link } from "react-router-dom";
import type { SetInput, WorkoutSet } from "../../hooks/useWorkouts";
import {
  describeSet,
  describeSetShort,
  groupSets,
  setLabels,
  summarizeSets,
} from "../../functions/workoutSets";
import { formatClock } from "../../functions/formatDuration";
import SetForm from "./SetForm";
import SupersetTag from "./SupersetTag";
import { bodyPartLabel } from "../../functions/bodyPartScores";

// The rest timed before a set, shown after what was done.
function RestNote({
  seconds,
  dense,
}: {
  seconds: number | null;
  dense?: boolean;
}) {
  if (seconds == null) return null;
  if (dense)
    return (
      <span className="shrink-0 text-xs font-semibold text-base-content/55 dark:text-base-content/75">
        rest {formatClock(seconds)}
      </span>
    );
  return (
    <span className="ml-2 text-xs font-semibold text-base-content/50 dark:text-base-content/75">
      after {formatClock(seconds)} rest
    </span>
  );
}

interface SetListProps {
  sets: WorkoutSet[];
  // Exercise names for the edit form.
  suggestions?: string[];
  onUpdate?: (set: WorkoutSet, changes: SetInput) => void;
  // Deletes one set, or all of an exercise's sets in this workout.
  onRemove?: (sets: WorkoutSet[]) => void;
  // Turns a set into two, halving its time.
  onSplit?: (set: WorkoutSet) => void;
  // Whether an exercise is done one side at a time, for the edit form.
  isUnilateral?: (exercise: string) => boolean;
  // Tighter rows for past workouts: a summary beside each exercise and one
  // short line per set ("1 L  10 × 45 lb  0:42  rest 1:30").
  dense?: boolean;
  // Superset letters by lowercased exercise name, for the dense header.
  supersetTags?: Map<string, string>;
  // The body parts an exercise works, main one first, shown under its name
  // in the dense header so it lines up with the workout's body-part summary.
  bodyPartsOf?: (exerciseName: string) => string[];
  // The latest exercise on top and its latest set first, for a workout in
  // progress. Set numbers still count up from the first set.
  newestFirst?: boolean;
  // The sets of one exercise in a card that already names it.
  hideNames?: boolean;
}

// What a set did, in the dense row: the load, then its time when it has one.
function DenseSet({ set }: { set: WorkoutSet }) {
  const load = describeSetShort(set);
  const timed =
    (set.reps !== null || set.weight !== null) && set.duration_seconds !== null;
  return (
    <span className="flex-1 min-w-0 truncate">
      {load}
      {timed && (
        <span className="text-base-content/55 dark:text-base-content/75">
          {" "}
          · {formatClock(set.duration_seconds!)}
        </span>
      )}
    </span>
  );
}

export default function SetList({
  sets,
  suggestions = [],
  onUpdate,
  onRemove,
  onSplit,
  isUnilateral,
  dense = false,
  supersetTags,
  bodyPartsOf,
  newestFirst = false,
  hideNames = false,
}: SetListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const groups = groupSets(sets).map(({ name, sets }) => ({
    name,
    sets,
    labels: setLabels(sets, dense),
  }));
  if (newestFirst) {
    const order = new Map(sets.map((s, i) => [s.id, i]));
    const latest = (g: { sets: WorkoutSet[] }) => order.get(g.sets.at(-1)!.id)!;
    groups.sort((a, b) => latest(b) - latest(a));
    for (const g of groups) {
      g.sets = [...g.sets].reverse();
      g.labels = [...g.labels].reverse();
    }
  }

  return (
    <div className={`flex flex-col ${dense ? "gap-3" : "gap-4"}`}>
      {groups.map(({ name, sets, labels }) => {
        const tag = supersetTags?.get(name.trim().toLowerCase());
        // The library entry, so you can see or change what it works.
        const exerciseId = sets.find((s) => s.exercise_id)?.exercise_id;
        // Unknown exercises count as "Other" in the summary, so say so here.
        const found = dense && bodyPartsOf ? bodyPartsOf(name) : [];
        const parts =
          found.length > 0 ? found : dense && bodyPartsOf ? ["other"] : [];
        return (
          <div key={name}>
            {dense ? (
              <div className="flex items-baseline gap-2">
                {tag && <SupersetTag letter={tag} />}
                <p className="flex-1 min-w-0 truncate text-sm font-bold">
                  {exerciseId ? (
                    <Link
                      to={`/workouts/library/${exerciseId}`}
                      className="underline decoration-base-content/25 underline-offset-2 hover:decoration-current"
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-base-content/55 dark:text-base-content/75">
                  {summarizeSets(sets)}
                </span>
              </div>
            ) : (
              !hideNames && <p className="font-bold">{name}</p>
            )}
            {parts.length > 0 && (
              <ul
                className="mt-1 flex flex-wrap gap-1"
                aria-label={`Works ${parts.map(bodyPartLabel).join(", ")}`}
              >
                {parts.map((part, i) => (
                  <li
                    key={part}
                    className={`rounded-md px-1.5 text-[11px] leading-[18px] font-semibold ${i === 0 ? "bg-primary/12 text-primary dark:bg-primary/25 dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]" : "bg-base-content/8 text-base-content/65 dark:bg-base-content/12 dark:text-base-content/80"}`}
                  >
                    {bodyPartLabel(part)}
                  </li>
                ))}
              </ul>
            )}
            <ol className={`flex flex-col ${dense ? "mt-0.5" : "mt-1"}`}>
              {sets.map((set, i) =>
                editingId === set.id && onUpdate ? (
                  <li key={set.id} className="py-2">
                    <SetForm
                      suggestions={suggestions}
                      initial={set}
                      isUnilateral={isUnilateral}
                      onSplit={
                        onSplit &&
                        (() => {
                          onSplit(set);
                          setEditingId(null);
                        })
                      }
                      onDelete={
                        onRemove &&
                        (() => {
                          onRemove([set]);
                          setEditingId(null);
                        })
                      }
                      onDeleteExercise={
                        onRemove && sets.length > 1
                          ? {
                              label: `Delete ${name} (all ${sets.length} sets)`,
                              run: () => {
                                onRemove(sets);
                                setEditingId(null);
                              },
                            }
                          : undefined
                      }
                      submitLabel="Save"
                      onCancel={() => setEditingId(null)}
                      onAdd={(changes) => {
                        onUpdate(set, changes);
                        setEditingId(null);
                      }}
                    />
                  </li>
                ) : (
                  <li
                    key={set.id}
                    className={`flex items-center font-medium text-base-content/80 dark:text-[color-mix(in_oklab,var(--color-base-content),white_30%)] ${dense ? "gap-2 min-h-6 text-sm" : "gap-3 min-h-8"}`}
                  >
                    <span
                      className={`shrink-0 text-xs font-semibold tracking-wide text-base-content/50 dark:text-base-content/75 ${dense ? "w-8 tabular-nums" : "w-22"}`}
                      aria-label={dense ? labels[i] : undefined}
                    >
                      {dense ? labels[i].replace("Set ", "") : labels[i]}
                    </span>
                    {dense ? (
                      <button
                        type="button"
                        className="flex-1 min-w-0 flex items-center gap-3 text-left tabular-nums cursor-pointer hover:text-base-content dark:hover:text-base-content disabled:cursor-default"
                        disabled={!onUpdate}
                        onClick={() => setEditingId(set.id)}
                        aria-label={
                          onUpdate &&
                          `Edit ${labels[i].toLowerCase()} of ${name}: ${describeSet(set)}`
                        }
                      >
                        <DenseSet set={set} />
                        <RestNote seconds={set.rest_seconds} dense />
                      </button>
                    ) : onUpdate ? (
                      <button
                        type="button"
                        className="flex-1 text-left tabular-nums cursor-pointer hover:text-base-content dark:hover:text-base-content"
                        onClick={() => setEditingId(set.id)}
                        aria-label={`Edit ${labels[i].toLowerCase()} of ${name}: ${describeSet(set)}`}
                      >
                        {describeSet(set)}
                        <RestNote seconds={set.rest_seconds} />
                      </button>
                    ) : (
                      <span className="flex-1 tabular-nums">
                        {describeSet(set)}
                        <RestNote seconds={set.rest_seconds} />
                      </span>
                    )}
                    {onUpdate && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-circle btn-xs text-base-content/50 dark:text-base-content/75"
                        onClick={() => setEditingId(set.id)}
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    )}
                    {onRemove && !dense && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-circle btn-xs text-base-content/50 dark:text-base-content/75"
                        onClick={() => onRemove([set])}
                        aria-label={`Delete ${labels[i].toLowerCase()} of ${name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    )}
                  </li>
                ),
              )}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
