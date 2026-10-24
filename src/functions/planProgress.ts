import type { WorkoutPlan, PlannedExercise } from "../hooks/useWorkoutPlans";
import type { Side, Workout, WorkoutSet } from "../hooks/useWorkouts";
import { WEIGHT_UNIT } from "./workoutSets";

const key = (name: string) => name.trim().toLowerCase();

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
  if (/sec|min|\d\s*s\b|\bm\b|km|mile|yd|ft|meter|metre/i.test(reps))
    return null;
  const match = reps.match(/\d+/);
  return match ? Number(match[0]) : null;
}

// The most recent set of an exercise, to prefill the next one. `workouts`
// is newest first; sets inside a workout are oldest first.
export function lastSetOf(
  name: string,
  workouts: Workout[],
): WorkoutSet | undefined {
  const k = key(name);
  for (const w of workouts)
    for (let i = w.workout_sets.length - 1; i >= 0; i--)
      if (key(w.workout_sets[i].exercise_name) === k) return w.workout_sets[i];
  return undefined;
}

const setsOf = (name: string, sets: WorkoutSet[]) => {
  const k = key(name);
  return sets.filter((s) => key(s.exercise_name) === k);
};

// A one-side-at-a-time set counts once both its left and right are done.
// Sets logged without a side count whole.
export function setsDone(exercise: PlannedExercise, sets: WorkoutSet[]) {
  const mine = setsOf(exercise.name, sets);
  if (!exercise.unilateral) return mine.length;
  const left = mine.filter((s) => s.side === "left").length;
  const right = mine.filter((s) => s.side === "right").length;
  return mine.length - left - right + Math.min(left, right);
}

// The side to do next: left first, then whichever side is behind.
export function nextSide(name: string, sets: WorkoutSet[]): Side {
  const mine = setsOf(name, sets);
  const left = mine.filter((s) => s.side === "left").length;
  const right = mine.filter((s) => s.side === "right").length;
  return left <= right ? "left" : "right";
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
  const k = key(name);
  let best: number | null = null;
  for (const w of workouts)
    for (const s of w.workout_sets)
      if (key(s.exercise_name) === k && s.weight !== null)
        best = Math.max(best ?? 0, s.weight);
  return best;
}
