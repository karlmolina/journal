import type { WorkoutSet } from "../hooks/useWorkouts";
import { formatClock } from "./formatDuration";
import { nameKey } from "./exerciseName";

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
    const key = nameKey(set.exercise_name);
    if (!groups.has(key))
      groups.set(key, { name: set.exercise_name, sets: [] });
    groups.get(key)!.sets.push(set);
  }
  return [...groups.values()];
}

// "Set 2", or "Set 2 L" ("Set 2 · Left" when not short) for one side of a
// one-side-at-a-time set. Each side counts its own sets, so a left and a
// right share a number.
export function setLabels(sets: WorkoutSet[], short = true) {
  const counts = { left: 0, right: 0, none: 0 };
  return sets.map((s) => {
    const n = ++counts[s.side ?? "none"];
    if (!s.side) return `Set ${n}`;
    if (short) return `Set ${n} ${s.side === "left" ? "L" : "R"}`;
    return `Set ${n} · ${s.side === "left" ? "Left" : "Right"}`;
  });
}

// The short form for tight rows: "10 × 45 lb", "10 reps", "45 lb", "0:42".
export function describeSetShort(set: WorkoutSet) {
  if (set.reps !== null && set.weight !== null)
    return `${set.reps} × ${set.weight} ${WEIGHT_UNIT}`;
  if (set.reps !== null)
    return `${set.reps} ${set.reps === 1 ? "rep" : "reps"}`;
  if (set.weight !== null) return `${set.weight} ${WEIGHT_UNIT}`;
  return set.duration_seconds !== null ? formatClock(set.duration_seconds) : "";
}

// The heaviest set, then the most reps, then the longest.
function bestSet(sets: WorkoutSet[]) {
  const score = (s: WorkoutSet) => [
    s.weight ?? -1,
    s.reps ?? -1,
    s.duration_seconds ?? -1,
  ];
  return sets.reduce((best, s) => {
    const [a, b] = [score(s), score(best)];
    const i = a.findIndex((v, j) => v !== b[j]);
    return i >= 0 && a[i] > b[i] ? s : best;
  });
}

// Sets of one exercise, where a left and a right make one set.
export function setCount(sets: WorkoutSet[]) {
  const left = sets.filter((s) => s.side === "left").length;
  const right = sets.filter((s) => s.side === "right").length;
  return sets.length - left - right + Math.max(left, right);
}

// One exercise at a glance: "3 × 10 · 45 lb" when every set matched,
// otherwise "4 sets · best 12 × 50 lb". A left and a right make one set, and
// set times only count for exercises timed without reps or weight.
export function summarizeSets(sets: WorkoutSet[]) {
  const count = setCount(sets);
  const first = sets[0];
  const same = sets.every((s) =>
    s.reps !== null || s.weight !== null
      ? s.reps === first.reps && s.weight === first.weight
      : first.reps === null &&
        first.weight === null &&
        s.duration_seconds === first.duration_seconds,
  );
  if (!same) return `${count} sets · best ${describeSetShort(bestSet(sets))}`;
  const load = [
    first.reps,
    first.weight !== null && `${first.weight} ${WEIGHT_UNIT}`,
  ].filter((v) => v !== null && v !== false);
  if (load.length > 0) return `${count} × ${load.join(" · ")}`;
  if (first.duration_seconds !== null)
    return `${count} × ${formatClock(first.duration_seconds)}`;
  return `${count} ${count === 1 ? "set" : "sets"}`;
}

// Total weight moved: reps × weight over every set that has both.
export function totalVolume(sets: WorkoutSet[]) {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0);
}
