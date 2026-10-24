import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ActiveWorkout, {
  type PlannedWorkout,
} from "../../components/workouts/ActiveWorkout";
import WorkoutHistoryCard from "../../components/workouts/WorkoutHistoryCard";
import Chip from "../../components/Chip";
import ErrorBanner from "../../components/ErrorBanner";
import { useAuth } from "../../context/AuthContext";
import useWorkouts, {
  type SetInput,
  type WorkoutSet,
} from "../../hooks/useWorkouts";
import useExercises from "../../hooks/useExercises";
import useExerciseNotes from "../../hooks/useExerciseNotes";
import useWorkoutPlans, { type WorkoutPlan } from "../../hooks/useWorkoutPlans";
import {
  lastSetOf,
  nextSessionIndex,
  plannedReps,
} from "../../functions/planProgress";

function UpNext({
  plan,
  next,
  onStart,
}: {
  plan: WorkoutPlan;
  next: number;
  onStart: (session: number) => void;
}) {
  const sessions = plan.plan.sessions;
  const [chosen, setChosen] = useState<number | null>(null);
  const index = chosen !== null && chosen < sessions.length ? chosen : next;
  const session = sessions[index];
  return (
    <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-5 sm:px-5 flex flex-col gap-1">
      <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
        {index === next ? "Up next" : "From your plan"} · {plan.plan.title}
      </p>
      <p className="text-lg font-bold leading-snug">
        {session.day}: {session.focus}
      </p>
      <p className="text-sm font-medium text-base-content/60 dark:text-base-content/80">
        {session.exercises.length}{" "}
        {session.exercises.length === 1 ? "exercise" : "exercises"} · about{" "}
        {session.duration_minutes} min
      </p>
      {sessions.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Plan days">
          {sessions.map((s, i) => (
            <Chip key={i} selected={i === index} onClick={() => setChosen(i)}>
              {s.day}
            </Chip>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-lg rounded-full font-bold mt-3 active:scale-95 transition"
        onClick={() => onStart(index)}
      >
        Start {session.day}
      </button>
    </section>
  );
}

export default function Session() {
  const { user } = useAuth();
  const userId = user?.id;
  const {
    active,
    history,
    loading,
    hasMore,
    error,
    dismissError,
    loadMore,
    start,
    pause,
    resume,
    finish,
    discard,
    setSupersets,
    removeWorkout,
    addSet,
    updateSet,
    removeSet,
  } = useWorkouts(userId);
  const { exercises, byLowerName } = useExercises(userId);
  const { plans } = useWorkoutPlans(userId);
  const notes = useExerciseNotes(userId);
  const latestPlan = plans.find((p) => p.plan.sessions.length > 0);
  // Set by the library's "Log this exercise" button.
  const initialExercise: string | undefined = useLocation().state?.exercise;

  // Exercises used before (most recent first), then the rest of the library.
  const suggestions = useMemo(() => {
    const names = new Map<string, string>();
    const workouts = active ? [active, ...history] : history;
    for (const w of workouts)
      for (const s of [...w.workout_sets].reverse()) {
        const key = s.exercise_name.toLowerCase();
        if (!names.has(key)) names.set(key, s.exercise_name);
      }
    for (const e of exercises)
      if (!names.has(e.name.toLowerCase()))
        names.set(e.name.toLowerCase(), e.name);
    return [...names.values()];
  }, [active, history, exercises]);

  const linkExercise = useCallback(
    (set: SetInput) => ({
      ...set,
      exercise_id: byLowerName.get(set.exercise_name.toLowerCase())?.id ?? null,
    }),
    [byLowerName],
  );
  const handleAddSet = useCallback(
    (set: SetInput) => addSet(linkExercise(set)),
    [addSet, linkExercise],
  );
  const handleUpdateSet = useCallback(
    (set: WorkoutSet, changes: SetInput) =>
      updateSet(set, linkExercise(changes)),
    [updateSet, linkExercise],
  );

  // The plan session the running workout follows, if it still exists.
  // Plans that don't say whether an exercise is one side at a time take it
  // from the library.
  const planned = useMemo((): PlannedWorkout | undefined => {
    const plan = active?.plan_id
      ? plans.find((p) => p.id === active.plan_id)
      : undefined;
    const session = plan?.plan.sessions[active?.plan_session ?? -1];
    return plan && session
      ? {
          planTitle: plan.plan.title,
          session: {
            ...session,
            exercises: session.exercises.map((e) => ({
              ...e,
              unilateral:
                e.unilateral ??
                byLowerName.get(e.name.trim().toLowerCase())?.unilateral ??
                false,
            })),
          },
        }
      : undefined;
  }, [active, plans, byLowerName]);

  const isUnilateral = useCallback(
    (name: string) => {
      const k = name.trim().toLowerCase();
      const target = planned?.session.exercises.find(
        (e) => e.name.trim().toLowerCase() === k,
      );
      return target?.unilateral ?? byLowerName.get(k)?.unilateral ?? false;
    },
    [planned, byLowerName],
  );

  const lookup = useCallback(
    (name: string) => byLowerName.get(name.trim().toLowerCase()),
    [byLowerName],
  );

  // Reps from the plan, weight from the last time you did it.
  const prefillFor = useCallback(
    (name: string): Partial<SetInput> => {
      const last = lastSetOf(name, active ? [active, ...history] : history);
      const target = planned?.session.exercises.find(
        (e) => e.name.toLowerCase() === name.toLowerCase(),
      );
      return {
        reps: (target && plannedReps(target.reps)) ?? last?.reps ?? null,
        // Your last weight once you've done it; the plan's until then.
        weight: last?.weight ?? target?.weight ?? null,
      };
    },
    [active, history, planned],
  );

  return (
    <>
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}
      {notes.error && (
        <ErrorBanner message={notes.error} onDismiss={notes.dismissError} />
      )}

      {active ? (
        <ActiveWorkout
          key={active.id}
          workout={active}
          suggestions={suggestions}
          planned={planned}
          timerKey={`set_timer_${userId}`}
          prefillFor={prefillFor}
          isUnilateral={isUnilateral}
          lookup={lookup}
          noteFor={notes.noteFor}
          onSaveNote={notes.saveNote}
          initialExercise={initialExercise}
          onPause={pause}
          onResume={resume}
          onFinish={finish}
          onDiscard={discard}
          onSupersetsChange={setSupersets}
          onAddSet={handleAddSet}
          onUpdateSet={handleUpdateSet}
          onRemoveSet={removeSet}
        />
      ) : (
        <div className="flex flex-col pb-6">
          {latestPlan ? (
            <div className="flex flex-col gap-2">
              <UpNext
                plan={latestPlan}
                next={nextSessionIndex(latestPlan, plans, history)}
                onStart={(session) =>
                  start({ plan_id: latestPlan.id, plan_session: session })
                }
              />
              <button
                type="button"
                className="btn btn-ghost rounded-full font-bold self-center"
                onClick={() => start()}
              >
                Start an empty workout
              </button>
            </div>
          ) : (
            <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-8 flex flex-col items-center text-center gap-1">
              <p className="text-lg font-bold">Ready to train?</p>
              <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75 mb-4">
                The stopwatch starts as soon as you tap.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg rounded-full font-bold px-8 active:scale-95 transition"
                onClick={() => start()}
              >
                Start workout
              </button>
              <Link
                to="/workouts/plan"
                className="mt-2 text-sm font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_45%)] hover:underline"
              >
                Or have AI plan your week
              </Link>
            </section>
          )}

          {history.length > 0 && (
            <h2 className="mt-8 mb-3 ml-1 text-sm font-bold tracking-wide text-base-content/60 dark:text-base-content/80">
              Past workouts
            </h2>
          )}
          <div className="flex flex-col gap-3">
            {history.map((w) => (
              <WorkoutHistoryCard
                key={w.id}
                workout={w}
                suggestions={suggestions}
                onUpdateSet={handleUpdateSet}
                onDelete={() => removeWorkout(w.id)}
              />
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-4 text-base-content/40 dark:text-base-content/70">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : (
            hasMore && (
              <button
                type="button"
                className="btn btn-ghost rounded-full font-bold mt-3 self-center"
                onClick={loadMore}
              >
                Show older workouts
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}
