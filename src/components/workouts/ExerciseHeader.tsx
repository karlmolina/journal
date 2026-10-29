import type { ReactNode } from "react";
import type { Exercise } from "../../hooks/useExercises";
import ExerciseHowTo from "./ExerciseHowTo";
import ExerciseNote, { type ExerciseNotesProps } from "./ExerciseNote";

// What the plan says: the set and target, then its tip and the goal, each
// on a line of its own.
export function PlanLines({
  target,
  notes,
  goal,
}: {
  target?: string;
  notes?: string;
  goal?: string;
}) {
  if (!target && !notes && !goal) return null;
  return (
    <div className="flex flex-col gap-0.5 text-sm text-base-content/60 dark:text-base-content/80">
      {target && <p className="font-semibold tabular-nums">{target}</p>}
      {notes && <p className="font-medium">{notes}</p>}
      {goal && <p className="font-medium">Goal: {goal}</p>}
    </div>
  );
}

// The exercise you're on, its plan and how it's done. The set timer shows it
// the same while a set runs, while it's filled in and before the next one,
// so the card doesn't jump around on Stop set; during a rest it heads the
// next exercise's card.
export default function ExerciseHeader({
  name,
  target,
  notes,
  goal,
  lookup,
  exerciseNotes,
  title,
}: {
  name: string;
  target?: string;
  notes?: string;
  goal?: string;
  lookup?: (exercise: string) => Exercise | undefined;
  exerciseNotes?: ExerciseNotesProps;
  // Stands in for the name, e.g. as a button.
  title?: ReactNode;
}) {
  return (
    <div className="w-full flex flex-col">
      {/* The biggest text on the screen: what you're doing now. */}
      <div className="flex items-center justify-between gap-2">
        {title ?? (
          <p className="text-4xl font-extrabold leading-tight tracking-tight">
            {name}
          </p>
        )}
      </div>
      <PlanLines target={target} notes={notes} goal={goal} />
      <div className="w-full mt-2 flex flex-col gap-2 text-left">
        <ExerciseHowTo exercise={lookup?.(name)} />
        {exerciseNotes && (
          <ExerciseNote
            key={name}
            exercise={name}
            regions={lookup?.(name)?.body_regions ?? []}
            {...exerciseNotes}
          />
        )}
      </div>
    </div>
  );
}
