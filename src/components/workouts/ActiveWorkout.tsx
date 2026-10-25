import { useEffect, useState } from "react";
import type { SetInput, Workout, WorkoutSet } from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import type { PlannedSession } from "../../hooks/useWorkoutPlans";
import type { Exercise } from "../../hooks/useExercises";
import type { ExerciseNotesProps } from "./ExerciseNote";
import useClock from "../../hooks/useClock";
import { formatClock } from "../../functions/formatDuration";
import {
  currentExerciseIndex,
  describeTarget,
  nextSide,
  setsDone,
  sideLabel,
} from "../../functions/planProgress";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import {
  countSets,
  joinSupersets,
  leaveSuperset,
  nextInSuperset,
  planSupersets,
  splitSuperset,
  supersetOf,
  type Supersets,
} from "../../functions/supersets";
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
  // The library entry for an exercise, for its description.
  lookup: (exercise: string) => Exercise | undefined;
  // Your own notes on exercises.
  exerciseNotes: ExerciseNotesProps;
  onPause: () => void;
  onResume: () => void;
  onFinish: (notes: string) => void;
  onDiscard: () => void;
  onSupersetsChange: (supersets: Supersets) => void;
  initialExercise?: string;
  onAddSet: (set: SetInput) => void;
  onUpdateSet: (set: WorkoutSet, changes: SetInput) => void;
  onRemoveSet: (set: WorkoutSet) => void;
  onSplitSet: (set: WorkoutSet) => void;
}

// Between two planned exercises: whether they're a superset, and a tap to
// pair them up or split them.
function SupersetLink({
  linked,
  onToggle,
}: {
  linked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-center -my-0.5">
      <button
        type="button"
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition cursor-pointer ${
          linked
            ? "bg-primary/15 text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]"
            : "text-base-content/40 dark:text-base-content/70 hover:text-base-content/70 dark:hover:text-base-content/90 hover:bg-base-content/6"
        }`}
        onClick={onToggle}
        aria-pressed={linked}
      >
        {linked ? "Superset · tap to split" : "+ Superset"}
      </button>
    </div>
  );
}

function PlanChecklist({
  session,
  sets,
  supersets,
  selected,
  onSelect,
  onLink,
}: {
  session: PlannedSession;
  sets: WorkoutSet[];
  supersets: Supersets;
  selected: number | null;
  onSelect: (i: number) => void;
  onLink: (i: number, linked: boolean) => void;
}) {
  const exercises = session.exercises;
  const groupOf = (i: number) =>
    exercises[i] && supersetOf(exercises[i].name, supersets);
  // The rest after a round: the longest any of its exercises asks for.
  const roundRest = (group: string[]) =>
    Math.max(
      0,
      ...exercises
        .filter((e) => supersetOf(e.name, [group]))
        .map((e) => e.rest_seconds),
    );
  return (
    <ol className="mt-2 flex flex-col gap-1">
      {exercises.map((e, i) => {
        const done = setsDone(e, sets);
        const complete = done >= e.sets;
        const group = groupOf(i);
        const linked = i > 0 && !!group && group === groupOf(i - 1);
        return (
          <li key={i} className="flex flex-col gap-1">
            {i > 0 && (
              <SupersetLink
                linked={linked}
                onToggle={() => onLink(i, linked)}
              />
            )}
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
                    : "bg-base-content/10 text-base-content/60 dark:text-base-content/80"
                }`}
                aria-hidden="true"
              >
                {complete ? "✓" : i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={`block font-bold truncate ${complete ? "text-base-content/50 dark:text-base-content/75 line-through" : ""}`}
                >
                  {e.name}
                </span>
                <span className="block text-xs font-semibold text-base-content/55 dark:text-base-content/75 tabular-nums">
                  {describeTarget(e)}
                  {!group
                    ? e.rest_seconds > 0 && ` · rest ${e.rest_seconds}s`
                    : groupOf(i + 1) !== group &&
                      roundRest(group) > 0 &&
                      ` · then rest ${roundRest(group)}s`}
                </span>
              </span>
              <span className="text-sm font-bold tabular-nums text-base-content/60 dark:text-base-content/80">
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
  lookup,
  exerciseNotes,
  initialExercise,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onSupersetsChange,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onSplitSet,
}: ActiveWorkoutProps) {
  const paused = workout.paused_at !== null;
  // One clock drives the workout time and the set and rest timers.
  const clockOrigin = Date.parse(workout.started_at);
  const now = useClock(clockOrigin);
  const sets = workout.workout_sets;
  const exercises = planned?.session.exercises ?? [];
  const supersets = workout.supersets ?? planSupersets(exercises);
  const indexOf = (name: string) =>
    exercises.findIndex(
      (e) => e.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  const done = (name: string, all = sets) =>
    countSets(name, isUnilateral(name), all);
  // Planned exercises have a number of sets; anything else goes on and on.
  const targetOf = (name: string) => exercises[indexOf(name)]?.sets ?? Infinity;

  // The exercise picked in the checklist; otherwise the next one in the
  // superset just done, or the first unfinished one.
  const [picked, setPicked] = useState<number | null>(null);
  const auto = (() => {
    const last = sets.at(-1);
    const group = last && supersetOf(last.exercise_name, supersets);
    if (last && group) {
      // A left side is followed by the right before moving on.
      const i =
        last.side === "left" && nextSide(last.exercise_name, sets) === "right"
          ? indexOf(last.exercise_name)
          : indexOf(
              nextInSuperset(last.exercise_name, group, done, targetOf).next ??
                "",
            );
      if (i !== -1 && setsDone(exercises[i], sets) < exercises[i].sets)
        return i;
    }
    return currentExerciseIndex(exercises, sets);
  })();
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
    const e = exercises[indexOf(name)];
    return e ? e.rest_seconds : DEFAULT_REST;
  };

  // In a superset the next exercise follows with no rest, and the rest comes
  // after the round (the longest any of its exercises asks for).
  const afterSet = (set: SetInput) => {
    const group = supersetOf(set.exercise_name, supersets);
    if (!group) return { rest: restFor(set.exercise_name) };
    const all = [...sets, set as WorkoutSet];
    const { next, rest } = nextInSuperset(
      set.exercise_name,
      group,
      (n) => done(n, all),
      targetOf,
    );
    return {
      rest: rest ? Math.max(...group.map(restFor)) : 0,
      next: next ?? undefined,
    };
  };

  const supersetWith = (name: string) =>
    supersetOf(name, supersets)?.filter(
      (n) => n.trim().toLowerCase() !== name.trim().toLowerCase(),
    );

  const handleSave = (set: SetInput) => {
    onAddSet(set);
    // Once the picked exercise has all its sets, or it's in a superset, go
    // back to following the plan, which moves through the superset.
    if (supersetOf(set.exercise_name, supersets)) setPicked(null);
    else if (
      selected &&
      set.exercise_name.toLowerCase() === selected.name.toLowerCase() &&
      setsDone(selected, [...sets, set as WorkoutSet]) >= selected.sets
    )
      setPicked(null);
  };
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [notes, setNotes] = useState("");
  const elapsed = formatClock(elapsedSeconds(workout, now));

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
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
          {paused ? "Paused" : "In progress"} · started {started}
        </p>
        <p
          className={`mt-0.5 mb-2 text-3xl font-extrabold tracking-tight tabular-nums transition-opacity ${
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
              className="w-full resize-none rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65 text-left"
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
          <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
            {planned.planTitle} · {planned.session.day}
          </p>
          <h2 className="font-bold">{planned.session.focus}</h2>
          <PlanChecklist
            session={planned.session}
            sets={sets}
            supersets={supersets}
            selected={selectedIndex}
            onSelect={setPicked}
            onLink={(i, linked) =>
              onSupersetsChange(
                linked
                  ? splitSuperset(supersets, exercises[i].name)
                  : joinSupersets(
                      supersets,
                      exercises[i - 1].name,
                      exercises[i].name,
                    ),
              )
            }
          />
          {auto === null && exercises.length > 0 && (
            <p className="mt-2 text-sm font-bold text-center text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]">
              Every planned set is done. Nice work.
            </p>
          )}
        </section>
      )}

      <section className={cardClass}>
        <SetTimer
          workoutId={workout.id}
          storageKey={timerKey}
          now={now}
          clockOrigin={clockOrigin}
          exercise={selected?.name ?? initialExercise ?? ""}
          target={target || undefined}
          notes={
            [selected?.notes, selected?.goal && `Goal ${selected.goal}`]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          suggestions={suggestions}
          prefillFor={prefillFor}
          afterSet={afterSet}
          sideFor={sideFor}
          supersetWith={supersetWith}
          onSuperset={(name, partner) =>
            onSupersetsChange(joinSupersets(supersets, name, partner))
          }
          onLeaveSuperset={(name) =>
            onSupersetsChange(leaveSuperset(supersets, name))
          }
          lookup={lookup}
          exerciseNotes={exerciseNotes}
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
            onSplit={onSplitSet}
            isUnilateral={isUnilateral}
          />
        </section>
      )}

      <div className="flex justify-center pb-6">
        {confirmDiscard ? (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-base-content/60 dark:text-base-content/80">
              Delete this workout?
            </span>
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
            className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55 dark:text-base-content/75"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard workout
          </button>
        )}
      </div>
    </div>
  );
}
