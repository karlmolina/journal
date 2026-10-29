import type { Exercise } from "../hooks/useExercises";
import type { Workout } from "../hooks/useWorkouts";

// Exercise names for an exercise field: the ones done before (most recent
// first), then the rest of the library.
export function exerciseSuggestions(
  workouts: Workout[],
  exercises: Exercise[],
) {
  const names = new Map<string, string>();
  for (const w of workouts)
    for (const s of [...w.workout_sets].reverse()) {
      const key = s.exercise_name.toLowerCase();
      if (!names.has(key)) names.set(key, s.exercise_name);
    }
  for (const e of exercises)
    if (!names.has(e.name.toLowerCase()))
      names.set(e.name.toLowerCase(), e.name);
  return [...names.values()];
}
