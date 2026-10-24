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

// "Set 2", or "Set 2 L" for one side of a one-side-at-a-time set. Each side
// counts its own sets, so a left and a right share a number.
export function setLabels(sets: WorkoutSet[]) {
  const counts = { left: 0, right: 0, none: 0 };
  return sets.map((s) => {
    const n = ++counts[s.side ?? "none"];
    return s.side ? `Set ${n} ${s.side === "left" ? "L" : "R"}` : `Set ${n}`;
  });
}
