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
  type Workout,
  type WorkoutSet,
} from "../../hooks/useWorkouts";
import useExercises from "../../hooks/useExercises";
import useExerciseNotes from "../../hooks/useExerciseNotes";
import useInjuries from "../../hooks/useInjuries";
import useWorkoutPlans, { type WorkoutPlan } from "../../hooks/useWorkoutPlans";
import { guessBodyParts } from "../../functions/bodyPartScores";
import { planSupersets, type Supersets } from "../../functions/supersets";
import {
  applyPlanChanges,
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
  // The workout itself is the start button: one big tap target.
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        className="w-full rounded-3xl bg-primary text-primary-content px-5 py-7 sm:px-6 flex flex-col items-start gap-1 text-left shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
        onClick={() => onStart(index)}
      >
        <span className="text-xs font-semibold tracking-wide opacity-80">
          {index === next ? "Up next" : "From your plan"} · {plan.plan.title}
        </span>
        <span className="text-2xl font-extrabold leading-tight">
          {session.day}: {session.focus}
        </span>
        <span className="text-sm font-semibold opacity-85">
          {session.exercises.length}{" "}
          {session.exercises.length === 1 ? "exercise" : "exercises"} · about{" "}
          {session.duration_minutes} min
        </span>
        <span className="mt-4 self-stretch flex items-center justify-center gap-2 rounded-full bg-primary-content/15 py-3 text-lg font-bold">
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          </svg>
          Tap to start
        </span>
      </button>
      {sessions.length > 1 && (
        <div
          className="flex flex-wrap justify-center gap-1.5"
          aria-label="Plan days"
        >
          {sessions.map((s, i) => (
            <Chip key={i} selected={i === index} onClick={() => setChosen(i)}>
              {s.day}
            </Chip>
          ))}
        </div>
      )}
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
    setPlanChanges,
    removeWorkout,
    addSet,
    updateSet,
    removeSets,
    splitSet,
  } = useWorkouts(userId);
  const { exercises, byLowerName, ensureExercise } = useExercises(userId);
  const { plans } = useWorkoutPlans(userId);
  const notes = useExerciseNotes(userId);
  const { injuries } = useInjuries(userId);
  const exerciseNotes = { notes, injuries };
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

  // Every set links to the library; a name that isn't there yet is added as
  // your own exercise.
  const linkExercise = useCallback(
    (set: SetInput) => {
      const link = ensureExercise(set.exercise_name, set.side !== null);
      return {
        set: { ...set, exercise_id: link?.id ?? null },
        saved: link?.saved,
      };
    },
    [ensureExercise],
  );
  const handleAddSet = useCallback(
    (input: SetInput) => {
      const { set, saved } = linkExercise(input);
      addSet(set, saved);
    },
    [addSet, linkExercise],
  );
  const handleUpdateSet = useCallback(
    (prev: WorkoutSet, changes: SetInput) => {
      const { set, saved } = linkExercise(changes);
      updateSet(prev, set, saved);
    },
    [updateSet, linkExercise],
  );

  // The plan session the running workout follows, if it still exists, with
  // the exercises swapped or ended in this workout. Plans that don't say whether an exercise is one side at a time take it
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
            exercises: applyPlanChanges(
              session.exercises,
              active?.plan_changes ?? null,
            ).map((e) => ({
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

  // A past workout's supersets: its own, or else its plan session's.
  const supersetsOf = useCallback(
    (w: Workout): Supersets => {
      if (w.supersets) return w.supersets;
      const plan = w.plan_id
        ? plans.find((p) => p.id === w.plan_id)
        : undefined;
      const session = plan?.plan.sessions[w.plan_session ?? -1];
      return session
        ? planSupersets(applyPlanChanges(session.exercises, w.plan_changes))
        : [];
    },
    [plans],
  );

  // Library body parts for an exercise, or a guess from its name.
  const bodyPartsOf = useCallback(
    (name: string) => {
      const exercise = lookup(name);
      if (exercise?.category === "cardio") return ["cardio"];
      const regions = exercise?.body_regions ?? [];
      return regions.length > 0 ? regions : guessBodyParts(name);
    },
    [lookup],
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
          exerciseNotes={exerciseNotes}
          initialExercise={initialExercise}
          onPause={pause}
          onResume={resume}
          onFinish={finish}
          onDiscard={discard}
          onSupersetsChange={setSupersets}
          onPlanChange={setPlanChanges}
          onAddSet={handleAddSet}
          onUpdateSet={handleUpdateSet}
          onRemoveSets={removeSets}
          onSplitSet={splitSet}
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
                className="mt-2 text-sm font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] hover:underline"
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
          <div className="flex flex-col gap-2">
            {history.map((w) => (
              <WorkoutHistoryCard
                key={w.id}
                workout={w}
                supersets={supersetsOf(w)}
                bodyPartsOf={bodyPartsOf}
                suggestions={suggestions}
                isUnilateral={isUnilateral}
                onUpdateSet={handleUpdateSet}
                onSplitSet={splitSet}
                onRemoveSets={removeSets}
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
