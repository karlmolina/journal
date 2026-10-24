import { useState } from "react";
import type { SetInput, WorkoutSet } from "../../hooks/useWorkouts";
import { describeSet, groupSets, setLabels } from "../../functions/workoutSets";
import { formatClock } from "../../functions/formatDuration";
import SetForm from "./SetForm";

// The rest timed before a set, shown after what was done.
function RestNote({ seconds }: { seconds: number | null }) {
  if (seconds == null) return null;
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
  onRemove?: (set: WorkoutSet) => void;
}

export default function SetList({
  sets,
  suggestions = [],
  onUpdate,
  onRemove,
}: SetListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {groupSets(sets).map(({ name, sets }) => {
        const labels = setLabels(sets);
        return (
          <div key={name}>
            <p className="font-bold">{name}</p>
            <ol className="mt-1 flex flex-col">
              {sets.map((set, i) =>
                editingId === set.id && onUpdate ? (
                  <li key={set.id} className="py-2">
                    <SetForm
                      suggestions={suggestions}
                      initial={set}
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
                    className="flex items-center gap-3 min-h-8 font-medium text-base-content/80 dark:text-[color-mix(in_oklab,var(--color-base-content),white_30%)]"
                  >
                    <span className="w-14 shrink-0 text-xs font-semibold tracking-wide text-base-content/50 dark:text-base-content/75">
                      {labels[i]}
                    </span>
                    {onUpdate ? (
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
                    {onRemove && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-circle btn-xs text-base-content/50 dark:text-base-content/75"
                        onClick={() => onRemove(set)}
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
