import type { WorkoutPlan, PlannedExercise } from "../hooks/useWorkoutPlans";
import type {
  PlanChanges,
  Side,
  Workout,
  WorkoutSet,
} from "../hooks/useWorkouts";
import { WEIGHT_UNIT } from "./workoutSets";
import { countSets } from "./supersets";
import { nameKey } from "./exerciseName";

// The plan and every earlier version it was revised from, so workouts done
// on an older version still count toward where you are in the plan.
function lineage(plan: WorkoutPlan, plans: WorkoutPlan[]) {
  const ids = new Set<string>();
  let current: WorkoutPlan | undefined = plan;
  while (current && !ids.has(current.id)) {
    ids.add(current.id);
    const parent: string | null | undefined = current.revised_from;
    current = parent ? plans.find((p) => p.id === parent) : undefined;
  }
  return ids;
}

// Plan sessions are numbered days done in order, not weekdays. Older plans
// named them "Mon", "Wed"..., so the label always comes from the position.
export const dayLabel = (index: number) => `Day ${index + 1}`;

// The session after the last one you did, wrapping around to the first.
// `workouts` is newest first.
export function nextSessionIndex(
  plan: WorkoutPlan,
  plans: WorkoutPlan[],
  workouts: Workout[],
) {
  const count = plan.plan.sessions.length;
  if (count === 0) return 0;
  const ids = lineage(plan, plans);
  const last = workouts.find(
    (w) => w.plan_id && ids.has(w.plan_id) && w.plan_session != null,
  );
  return last ? (last.plan_session! + 1) % count : 0;
}

// A starting rep count from the plan's text: "8-10" gives 8. Timed or
// distance targets ("30 sec", "400 m") give nothing; the set timer covers those.
export function plannedReps(reps: string): number | null {
  if (plannedSeconds(reps) != null) return null;
  if (/sec|min|\d\s*s\b|\bm\b|km|mile|yd|ft|meter|metre/i.test(reps))
    return null;
  const match = reps.match(/\d+/);
  return match ? Number(match[0]) : null;
}

// A set's planned time from the plan's text: "15 min" gives 900, "30-45 sec"
// gives 30, "1:30" gives 90. Rep and distance targets give nothing.
export function plannedSeconds(reps: string): number | null {
  const clock = reps.match(/\b(\d+):([0-5]\d)\b/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const match = reps.match(
    /(\d+(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(min|minutes?|mins|sec|seconds?|secs|s)\b/i,
  );
  if (!match) return null;
  const n = Number(match[1]);
  return Math.round(/^m/i.test(match[2]) ? n * 60 : n);
}

// The most recent set of an exercise, to prefill the next one. `workouts`
// is newest first; sets inside a workout are oldest first.
export function lastSetOf(
  name: string,
  workouts: Workout[],
): WorkoutSet | undefined {
  const k = nameKey(name);
  for (const w of workouts)
    for (let i = w.workout_sets.length - 1; i >= 0; i--)
      if (nameKey(w.workout_sets[i].exercise_name) === k)
        return w.workout_sets[i];
  return undefined;
}

const setsOf = (name: string, sets: WorkoutSet[]) => {
  const k = nameKey(name);
  return sets.filter((s) => nameKey(s.exercise_name) === k);
};

// A one-side-at-a-time set counts once both its left and right are done.
export const setsDone = (exercise: PlannedExercise, sets: WorkoutSet[]) =>
  countSets(exercise.name, exercise.unilateral ?? false, sets);

// One side at a time starts with the right, then the left.
export const FIRST_SIDE: Side = "right";
export const SECOND_SIDE: Side = "left";

// The side to do next: the first side, then whichever side is behind.
export function nextSide(name: string, sets: WorkoutSet[]): Side {
  const mine = setsOf(name, sets);
  const first = mine.filter((s) => s.side === FIRST_SIDE).length;
  const second = mine.filter((s) => s.side === SECOND_SIDE).length;
  return first <= second ? FIRST_SIDE : SECOND_SIDE;
}

export const sideLabel = (side: Side) =>
  side === "left" ? "Left side" : "Right side";

// The first planned exercise that still has sets to do.
export function currentExerciseIndex(
  exercises: PlannedExercise[],
  sets: WorkoutSet[],
) {
  const i = exercises.findIndex((e) => setsDone(e, sets) < e.sets);
  return i === -1 ? null : i;
}

// "3 × 8-10 · 45 lb", or "3 × 8-10 each side"
export function describeTarget(e: PlannedExercise) {
  return `${e.sets} × ${e.reps}${e.unilateral ? " each side" : ""}${e.weight != null ? ` · ${e.weight} ${WEIGHT_UNIT}` : ""}`;
}

// The heaviest weight logged for an exercise, if any.
export function bestWeight(name: string, workouts: Workout[]) {
  const k = nameKey(name);
  let best: number | null = null;
  for (const w of workouts)
    for (const s of w.workout_sets)
      if (nameKey(s.exercise_name) === k && s.weight !== null)
        best = Math.max(best ?? 0, s.weight);
  return best;
}

// A planned exercise as this workout does it: maybe swapped for another, or
// ended before all its sets.
export interface SessionExercise extends PlannedExercise {
  // The plan's exercise, when another is done instead.
  swapped_from?: string;
  ended?: boolean;
  // Added to this workout only, not the plan.
  added?: boolean;
  // Switched to or from one side at a time, just this workout.
  sides_changed?: boolean;
}

// The session's exercises with this workout's swaps and early ends. A swap
// keeps the sets, reps, rest and superset but not the old exercise's weight,
// goal or notes; whether it's one side at a time comes from the library.
export function applyPlanChanges(
  exercises: PlannedExercise[],
  changes: PlanChanges | null,
): SessionExercise[] {
  const all: SessionExercise[] = [
    ...exercises,
    ...(changes?.added ?? []).map((e) => ({ ...e, added: true })),
  ];
  return all.map((e, i) => {
    const swap = changes?.swaps?.[i];
    const ended = changes?.ended?.includes(i) ?? false;
    const swapped: SessionExercise = swap
      ? {
          name: swap,
          sets: e.sets,
          reps: e.reps,
          rest_seconds: e.rest_seconds,
          notes: "",
          superset: e.superset,
          swapped_from: e.name,
          added: e.added,
        }
      : { ...e };
    const unilateral = changes?.sides?.[i];
    const sided: SessionExercise =
      unilateral === undefined
        ? swapped
        : { ...swapped, unilateral, sides_changed: true };
    return ended ? { ...sided, ended } : sided;
  });
}

// Swaps the exercise at `index`; swapping back to the plan's undoes it. Either
// way it's no longer ended.
export function swapExercise(
  changes: PlanChanges | null,
  index: number,
  name: string,
  planned: string,
): PlanChanges {
  const swaps = { ...changes?.swaps };
  if (nameKey(name) === nameKey(planned)) delete swaps[index];
  else swaps[index] = name.trim();
  // Another exercise goes by its own sides.
  const sides = { ...changes?.sides };
  delete sides[index];
  return {
    ...changes,
    swaps,
    sides,
    ended: (changes?.ended ?? []).filter((i) => i !== index),
  };
}

// Ends the exercise at `index` early, or picks it back up.
export const endExercise = (
  changes: PlanChanges | null,
  index: number,
  ended: boolean,
): PlanChanges => ({
  ...changes,
  swaps: { ...changes?.swaps },
  ended: [
    ...(changes?.ended ?? []).filter((i) => i !== index),
    ...(ended ? [index] : []),
  ],
});

// Does the exercise at `index` one side at a time or both sides at once,
// just this workout; back to how it usually is undoes it.
export function setSides(
  changes: PlanChanges | null,
  index: number,
  unilateral: boolean,
  usual: boolean,
): PlanChanges {
  const sides = { ...changes?.sides };
  if (unilateral === usual) delete sides[index];
  else sides[index] = unilateral;
  return { ...changes, sides };
}

// Adds an exercise to this workout only, after everything else.
export const addToWorkout = (
  changes: PlanChanges | null,
  exercise: PlannedExercise,
): PlanChanges => ({
  ...changes,
  added: [...(changes?.added ?? []), exercise],
});

// A plan exercise's superset letter, if it's in one.
export const supersetLetter = (e: PlannedExercise) =>
  e.superset?.trim().toUpperCase() || undefined;

// Exercises in a row that share a superset letter, kept together.
export function supersetRuns(exercises: PlannedExercise[]) {
  const runs: { letter?: string; indices: number[] }[] = [];
  exercises.forEach((e, j) => {
    const last = runs.at(-1);
    const letter = supersetLetter(e);
    if (last && letter && last.letter === letter) last.indices.push(j);
    else runs.push({ letter, indices: [j] });
  });
  return runs;
}

// Moves the exercise at `index` one place up (-1) or down (1). Inside a
// superset it moves past its partner; at the superset's edge, or on its own,
// it moves past the whole neighboring exercise or superset, taking its own
// superset with it. `from[i]` is where the exercise now at i used to be.
export function moveExercise(
  exercises: PlannedExercise[],
  index: number,
  direction: -1 | 1,
): { exercises: PlannedExercise[]; from: number[] } | null {
  const runs = supersetRuns(exercises).map((r) => r.indices);
  const r = runs.findIndex((indices) => indices.includes(index));
  const run = runs[r];
  const pos = run.indexOf(index);
  if (run[pos + direction] !== undefined) {
    [run[pos], run[pos + direction]] = [run[pos + direction], run[pos]];
  } else {
    if (!runs[r + direction]) return null;
    [runs[r], runs[r + direction]] = [runs[r + direction], runs[r]];
  }
  const from = runs.flat();
  return { exercises: from.map((i) => exercises[i]), from };
}

// This workout's changes, still pointing at the same exercises after the
// plan day's exercises moved: `to(i)` is where the exercise at i went.
export const remapPlanChanges = (
  changes: PlanChanges,
  to: (index: number) => number,
): PlanChanges => ({
  ...changes,
  swaps: Object.fromEntries(
    Object.entries(changes.swaps ?? {}).map(([i, name]) => [
      String(to(Number(i))),
      name,
    ]),
  ),
  ended: (changes.ended ?? []).map(to),
  sides: Object.fromEntries(
    Object.entries(changes.sides ?? {}).map(([i, one]) => [
      String(to(Number(i))),
      one,
    ]),
  ),
});

// After a reorder, where each exercise went. Added ones keep their indexes.
export const movedTo = (from: number[]) => (i: number) => {
  const j = from.indexOf(i);
  return j === -1 ? i : j;
};

// After an exercise was added to the end of a plan day of `length`
// exercises: the ones added to the workout only move down one.
export const grewFrom = (length: number) => (i: number) =>
  i >= length ? i + 1 : i;

// A running workout's changes after its plan day changed, or null when it
// follows another day or has nothing to keep track of.
export function followPlanEdit(
  workout: Workout | null,
  plan: WorkoutPlan,
  session: number,
  to: (index: number) => number,
): PlanChanges | null {
  return workout?.plan_id === plan.id &&
    workout.plan_session === session &&
    workout.plan_changes
    ? remapPlanChanges(workout.plan_changes, to)
    : null;
}
