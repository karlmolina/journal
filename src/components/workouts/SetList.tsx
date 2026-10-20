import type { WorkoutSet } from "../../hooks/useWorkouts";
import { describeSet, groupSets } from "../../functions/workoutSets";

interface SetListProps {
  sets: WorkoutSet[];
  onRemove?: (set: WorkoutSet) => void;
}

export default function SetList({ sets, onRemove }: SetListProps) {
  return (
    <div className="flex flex-col gap-4">
      {groupSets(sets).map(({ name, sets }) => (
        <div key={name}>
          <p className="font-bold">{name}</p>
          <ol className="mt-1 flex flex-col">
            {sets.map((set, i) => (
              <li
                key={set.id}
                className="flex items-center gap-3 min-h-8 font-medium text-base-content/80 dark:text-[color-mix(in_oklab,var(--color-base-content),white_30%)]"
              >
                <span className="w-12 shrink-0 text-xs font-semibold tracking-wide text-base-content/50 dark:text-base-content/65">
                  Set {i + 1}
                </span>
                <span className="flex-1 tabular-nums">{describeSet(set)}</span>
                {onRemove && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-circle btn-xs text-base-content/50"
                    onClick={() => onRemove(set)}
                    aria-label={`Delete set ${i + 1} of ${name}`}
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
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
