import { useState } from "react";
import { vi } from "vitest";
import ActiveWorkout from "../components/workouts/ActiveWorkout";
import type { PlannedExercise } from "../hooks/useWorkoutPlans";
import type { SetInput, Workout, WorkoutSet } from "../hooks/useWorkouts";
import type { ExerciseNotes } from "../hooks/useExerciseNotes";
import { applyPlanChanges, setPrefill } from "../functions/planProgress";
import { nameKey } from "../functions/exerciseName";

// A planned exercise with the usual fields filled in.
export const exercise = (
  name: string,
  more: Partial<PlannedExercise> = {},
): PlannedExercise => ({
  name,
  sets: 2,
  reps: "8",
  rest_seconds: 60,
  notes: "",
  ...more,
});

const noNotes: ExerciseNotes = {
  notesFor: () => [],
  notesForInjury: () => [],
  addNote: async () => true,
  updateNote: async () => true,
  removeNote: () => {},
  error: null,
  dismissError: () => {},
} as unknown as ExerciseNotes;

// The workout page's active workout for a plan day, with the sets kept in
// memory the way the Session page keeps them. `onAddSet` and `onRemoveSets`
// are spies, to check what would be saved.
export function renderWorkout(
  exercises: PlannedExercise[],
  sets: WorkoutSet[] = [],
) {
  const onAddSet = vi.fn();
  const onRemoveSets = vi.fn();
  let latest: Workout;
  let n = sets.length;

  function Harness() {
    const [workout, setWorkout] = useState<Workout>({
      id: "w1",
      started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      paused_at: null,
      paused_seconds: 0,
      ended_at: null,
      notes: null,
      plan_id: "p1",
      plan_session: 0,
      supersets: null,
      plan_changes: null,
      workout_sets: sets,
    });
    latest = workout;
    const unilateral = (name: string) =>
      exercises.find((e) => nameKey(e.name) === nameKey(name))?.unilateral ??
      false;
    const update = (sets: (all: WorkoutSet[]) => WorkoutSet[]) =>
      setWorkout((w) => ({ ...w, workout_sets: sets(w.workout_sets) }));
    return (
      <ActiveWorkout
        workout={workout}
        planned={{
          planTitle: "Test plan",
          session: {
            day: "Day 1",
            focus: "Everything",
            duration_minutes: 30,
            exercises: applyPlanChanges(exercises, workout.plan_changes),
          },
        }}
        suggestions={[]}
        timerKey="set_timer_test"
        prefillFor={(name) => setPrefill(name, workout, [], exercises)}
        isUnilateral={unilateral}
        lookup={() => undefined}
        exerciseNotes={{ notes: noNotes, injuries: [] }}
        onPause={() => {}}
        onResume={() => {}}
        onElapsedChange={() => {}}
        onFinish={() => {}}
        onDiscard={() => {}}
        onSupersetsChange={(supersets) =>
          setWorkout((w) => ({ ...w, supersets }))
        }
        onPlanChange={(plan_changes, supersets) =>
          setWorkout((w) => ({
            ...w,
            plan_changes,
            ...(supersets && { supersets }),
          }))
        }
        onAddExercise={async () => true}
        onAddSet={(set: SetInput) => {
          onAddSet(set);
          n += 1;
          update((all) => [
            ...all,
            {
              id: `s${n}`,
              workout_id: "w1",
              exercise_id: null,
              rest_seconds: null,
              ...set,
              created_at: new Date(Date.now() + n).toISOString(),
            } as WorkoutSet,
          ]);
        }}
        onUpdateSet={(set, changes) =>
          update((all) =>
            all.map((s) => (s.id === set.id ? { ...s, ...changes } : s)),
          )
        }
        onRemoveSets={(gone) => {
          onRemoveSets(gone);
          update((all) => all.filter((s) => !gone.some((g) => g.id === s.id)));
        }}
        onSplitSet={() => {}}
      />
    );
  }

  return {
    Harness,
    onAddSet,
    onRemoveSets,
    sets: () => latest.workout_sets,
  };
}

// A set already done, to start a workout part way through.
export const doneSet = (
  name: string,
  more: Partial<WorkoutSet> = {},
): WorkoutSet => ({
  id: `done-${name}-${Math.random()}`,
  workout_id: "w1",
  exercise_name: name,
  exercise_id: null,
  reps: 8,
  weight: null,
  duration_seconds: 30,
  side: null,
  rest_seconds: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  ...more,
});
