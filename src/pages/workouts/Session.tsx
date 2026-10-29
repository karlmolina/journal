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
import useExercises, { type Exercise } from "../../hooks/useExercises";
import useExerciseNotes from "../../hooks/useExerciseNotes";
import useInjuries from "../../hooks/useInjuries";
import useWorkoutPlans, {
  type PlannedExercise,
  type WorkoutPlan,
} from "../../hooks/useWorkoutPlans";
import { equipmentFor } from "../../functions/equipment";
import { guessBodyParts } from "../../functions/bodyPartScores";
import { planSupersets, type Supersets } from "../../functions/supersets";
import {
  addToWorkout,
  applyPlanChanges,
  followPlanEdit,
  grewFrom,
  lastSetOf,
  dayLabel,
  nextSessionIndex,
  plannedReps,
  plannedSeconds,
  setsDone,
} from "../../functions/planProgress";
import { nameKey } from "../../functions/exerciseName";
import { exerciseSuggestions } from "../../functions/exerciseSuggestions";

// Only today's workout can be picked back up; an older one is history.
const startedToday = (w: Workout) =>
  new Date(w.started_at).toDateString() === new Date().toDateString();

function UpNext({
  plan,
  next,
  lookup,
  onStart,
}: {
  plan: WorkoutPlan;
  next: number;
  lookup: (name: string) => Exercise | undefined;
  onStart: (session: number) => void;
}) {
  const sessions = plan.plan.sessions;
  const [chosen, setChosen] = useState<number | null>(null);
  const index = chosen !== null && chosen < sessions.length ? chosen : next;
  const session = sessions[index];
  const equipment = useMemo(
    () => equipmentFor(session.exercises, lookup),
    [session, lookup],
  );
  return (
    <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-5 sm:px-5 flex flex-col gap-1">
      <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
        {index === next ? "Up next" : "From your plan"} · {plan.plan.title}
      </p>
      <p className="text-lg font-bold leading-snug">
        {dayLabel(index)}: {session.focus}
      </p>
      <p className="text-sm font-medium text-base-content/60 dark:text-base-content/80">
        {session.exercises.length}{" "}
        {session.exercises.length === 1 ? "exercise" : "exercises"} · about{" "}
        {session.duration_minutes} min
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
          Equipment
        </p>
        {equipment.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {equipment.map((need) => (
              <li key={need.item} className="text-sm leading-snug">
                <span className="font-bold">{need.item}</span>
                {need.optional && (
                  <span className="text-base-content/55 dark:text-base-content/75">
                    {" "}
                    (optional)
                  </span>
                )}
                <span className="text-base-content/55 dark:text-base-content/75">
                  {" "}
                  · {need.exercises.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-medium">Nothing needed</p>
        )}
      </div>
      {sessions.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Plan days">
          {sessions.map((_, i) => (
            <Chip key={i} selected={i === index} onClick={() => setChosen(i)}>
              {dayLabel(i)}
            </Chip>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-lg rounded-full font-bold mt-3 active:scale-95 transition"
        onClick={() => onStart(index)}
      >
        Start {dayLabel(index)}
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
    reopen,
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
  const { plans, addExercise } = useWorkoutPlans(userId);
  const notes = useExerciseNotes(userId);
  const { injuries } = useInjuries(userId);
  const exerciseNotes = { notes, injuries };
  const latestPlan = plans.find((p) => p.plan.sessions.length > 0);
  // Set by the library's "Log this exercise" button.
  const initialExercise: string | undefined = useLocation().state?.exercise;

  const suggestions = useMemo(
    () =>
      exerciseSuggestions(active ? [active, ...history] : history, exercises),
    [active, history, exercises],
  );

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
            day: dayLabel(active!.plan_session!),
            exercises: applyPlanChanges(
              session.exercises,
              active?.plan_changes ?? null,
            ).map((e) => ({
              ...e,
              unilateral:
                e.unilateral ??
                byLowerName.get(nameKey(e.name))?.unilateral ??
                false,
            })),
          },
        }
      : undefined;
  }, [active, plans, byLowerName]);

  // An exercise added during the workout: to this workout only, or to its
  // plan day too, so later workouts of that day have it.
  const handleAddExercise = async (
    exercise: PlannedExercise,
    toPlan: boolean,
  ) => {
    if (!active) return false;
    const found = byLowerName.get(exercise.name.toLowerCase());
    if (!found) ensureExercise(exercise.name, false);
    const named = { ...exercise, name: found?.name ?? exercise.name };
    const plan = plans.find((p) => p.id === active.plan_id);
    const session = active.plan_session;
    if (toPlan && plan && session != null) {
      const changes = followPlanEdit(
        active,
        plan,
        session,
        grewFrom(plan.plan.sessions[session].exercises.length),
      );
      if (changes) setPlanChanges(changes);
      return addExercise(plan, session, named);
    }
    setPlanChanges(addToWorkout(active.plan_changes, named));
    return true;
  };

  const isUnilateral = useCallback(
    (name: string) => {
      const k = nameKey(name);
      const target = planned?.session.exercises.find(
        (e) => nameKey(e.name) === k,
      );
      return target?.unilateral ?? byLowerName.get(k)?.unilateral ?? false;
    },
    [planned, byLowerName],
  );

  const lookup = useCallback(
    (name: string) => byLowerName.get(nameKey(name)),
    [byLowerName],
  );

  // This set's target from the plan: its reps, weight and time. Without
  // one, the last time you did it.
  const prefillFor = useCallback(
    (name: string): Partial<SetInput> => {
      const last = lastSetOf(name, active ? [active, ...history] : history);
      const target = planned?.session.exercises.find(
        (e) => e.name.toLowerCase() === name.toLowerCase(),
      );
      return {
        reps: (target && plannedReps(target.reps)) ?? last?.reps ?? null,
        weight: target?.weight ?? last?.weight ?? null,
        duration_seconds: (target && plannedSeconds(target.reps)) ?? null,
      };
    },
    [active, history, planned],
  );

  // A past workout's supersets: its own, or else its plan session's.
  // "Day 2 · Upper body" for a workout that followed a plan day.
  const planDayOf = useCallback(
    (w: Workout) => {
      if (!w.plan_id || w.plan_session == null) return undefined;
      const session = plans.find((p) => p.id === w.plan_id)?.plan.sessions[
        w.plan_session
      ];
      const day = dayLabel(w.plan_session);
      return session ? `${day} · ${session.focus}` : day;
    },
    [plans],
  );

  // Whether a plan workout did every exercise of its day (or ended it early),
  // so there's nothing left to continue.
  const planFinished = useCallback(
    (w: Workout) => {
      const session = plans.find((p) => p.id === w.plan_id)?.plan.sessions[
        w.plan_session ?? -1
      ];
      return (
        !!session &&
        applyPlanChanges(session.exercises, w.plan_changes).every(
          (e) =>
            e.ended ||
            setsDone(
              {
                ...e,
                unilateral:
                  e.unilateral ??
                  byLowerName.get(nameKey(e.name))?.unilateral ??
                  false,
              },
              w.workout_sets,
            ) >= e.sets,
        )
      );
    },
    [plans, byLowerName],
  );

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

  // The body parts an exercise works, from the library or a guess from its
  // name. Past workout cards sum them up by muscle group.
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
          onAddExercise={handleAddExercise}
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
                lookup={lookup}
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
            {history.map((w, i) => (
              <WorkoutHistoryCard
                key={w.id}
                workout={w}
                supersets={supersetsOf(w)}
                planDay={planDayOf(w)}
                bodyPartsOf={bodyPartsOf}
                suggestions={suggestions}
                isUnilateral={isUnilateral}
                onUpdateSet={handleUpdateSet}
                onSplitSet={splitSet}
                onRemoveSets={removeSets}
                onContinue={
                  i === 0 && startedToday(w) && !planFinished(w)
                    ? () => reopen(w.id)
                    : undefined
                }
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
