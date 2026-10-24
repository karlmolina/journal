import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ActiveWorkout from "../../components/workouts/ActiveWorkout";
import WorkoutHistoryCard from "../../components/workouts/WorkoutHistoryCard";
import ErrorBanner from "../../components/ErrorBanner";
import { useAuth } from "../../context/AuthContext";
import useWorkouts, { type SetInput } from "../../hooks/useWorkouts";
import useExercises from "../../hooks/useExercises";

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
    removeWorkout,
    addSet,
    removeSet,
  } = useWorkouts(userId);
  const { exercises, byLowerName } = useExercises(userId);
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

  const handleAddSet = useCallback(
    (set: SetInput) =>
      addSet({
        ...set,
        exercise_id:
          byLowerName.get(set.exercise_name.toLowerCase())?.id ?? null,
      }),
    [addSet, byLowerName],
  );

  return (
    <>
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      {active ? (
        <ActiveWorkout
          key={active.id}
          workout={active}
          suggestions={suggestions}
          initialExercise={initialExercise}
          onPause={pause}
          onResume={resume}
          onFinish={finish}
          onDiscard={discard}
          onAddSet={handleAddSet}
          onRemoveSet={removeSet}
        />
      ) : (
        <div className="flex flex-col pb-6">
          <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-8 flex flex-col items-center text-center gap-1">
            <p className="text-lg font-bold">Ready to train?</p>
            <p className="text-sm font-medium text-base-content/55 mb-4">
              The stopwatch starts as soon as you tap.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg rounded-full font-bold px-8 active:scale-95 transition"
              onClick={start}
            >
              Start workout
            </button>
          </section>

          {history.length > 0 && (
            <h2 className="mt-8 mb-3 ml-1 text-sm font-bold tracking-wide text-base-content/60">
              Past workouts
            </h2>
          )}
          <div className="flex flex-col gap-3">
            {history.map((w) => (
              <WorkoutHistoryCard
                key={w.id}
                workout={w}
                onDelete={() => removeWorkout(w.id)}
              />
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-4 text-base-content/40">
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
