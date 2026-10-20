import type { WorkoutSet } from "../hooks/useWorkouts";
import { formatClock } from "./formatDuration";

export const WEIGHT_UNIT = "lb";

export function describeSet(set: WorkoutSet) {
  const load = [
    set.reps !== null && `${set.reps} ${set.reps === 1 ? "rep" : "reps"}`,
    set.weight !== null && `${set.weight} ${WEIGHT_UNIT}`,
  ]
    .filter(Boolean)
    .join(" × ");
  const time =
    set.duration_seconds !== null && formatClock(set.duration_seconds);
  return [load, time].filter(Boolean).join(" · ");
}

// Sets grouped by exercise, in the order each exercise was first done.
export function groupSets(sets: WorkoutSet[]) {
  const groups = new Map<string, { name: string; sets: WorkoutSet[] }>();
  for (const set of sets) {
    const key = set.exercise_name.trim().toLowerCase();
    if (!groups.has(key))
      groups.set(key, { name: set.exercise_name, sets: [] });
    groups.get(key)!.sets.push(set);
  }
  return [...groups.values()];
}
