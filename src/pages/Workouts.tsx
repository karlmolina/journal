import { useMemo } from "react";
import TopBar from "../components/TopBar";
import ActiveWorkout from "../components/workouts/ActiveWorkout";
import WorkoutHistoryCard from "../components/workouts/WorkoutHistoryCard";
import { useAuth } from "../context/AuthContext";
import useWorkouts from "../hooks/useWorkouts";
import signOut from "../functions/signOut";

export default function Workouts() {
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

  // Every exercise name used before, most recent first, for autocomplete.
  const suggestions = useMemo(() => {
    const names = new Map<string, string>();
    const workouts = active ? [active, ...history] : history;
    for (const w of workouts)
      for (const s of [...w.workout_sets].reverse()) {
        const key = s.exercise_name.toLowerCase();
        if (!names.has(key)) names.set(key, s.exercise_name);
      }
    return [...names.values()];
  }, [active, history]);

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-6 min-h-dvh flex flex-col">
      <TopBar
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={() => signOut(userId)}
      />

      {error && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-error/15 px-4 py-3 text-sm font-semibold"
        >
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs rounded-full font-bold"
            onClick={dismissError}
          >
            Dismiss
          </button>
        </div>
      )}

      {active ? (
        <ActiveWorkout
          key={active.id}
          workout={active}
          suggestions={suggestions}
          onPause={pause}
          onResume={resume}
          onFinish={finish}
          onDiscard={discard}
          onAddSet={addSet}
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
    </div>
  );
}
