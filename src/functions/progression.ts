import type { PlannedExercise } from "../hooks/useWorkoutPlans";
import type { SetInput, Workout, WorkoutSet } from "../hooks/useWorkouts";
import { nameKey } from "./exerciseName";
import { plannedReps, plannedSeconds, setsDone } from "./planProgress";
import { WEIGHT_UNIT } from "./workoutSets";

// A nudge up from last time, for when you hit every planned set of an
// exercise: a little more weight, one more rep, or a few more seconds. Only a
// suggestion: the set starts with the usual numbers unless you take it.
export interface Progression {
  // What happened last time, like "Every set hit 10 reps at 45 lb last time."
  reason: string;
  // The new number, like "50 lb", "9 reps" or "35 sec".
  label: string;
  // The numbers the first set starts with once it's taken.
  prefill: Partial<SetInput>;
}

// The smallest jump most gyms have: 5 lb plates or dumbbells, 2.5 kg.
export const WEIGHT_STEP = WEIGHT_UNIT === "lb" ? 5 : 2.5;
// Holds go up in steps of five seconds.
const TIME_STEP = 5;

// The top of the plan's rep range: "8-10" gives 10, "12" gives 12.
export function topReps(reps: string): number | null {
  const bottom = plannedReps(reps);
  if (bottom == null) return null;
  const range = reps.match(/\d+\s*[-–]\s*(\d+)/);
  return range ? Math.max(bottom, Number(range[1])) : bottom;
}

const unit = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// The sets of `name` in the last finished workout that has any.
// `history` is newest first.
function lastTime(name: string, history: Workout[]): WorkoutSet[] {
  const k = nameKey(name);
  for (const w of history) {
    const mine = w.workout_sets.filter((s) => nameKey(s.exercise_name) === k);
    if (mine.length > 0) return mine;
  }
  return [];
}

// What to try today after last time, or null when there's nothing to nudge:
// no plan target, sets already done today, or a set fell short last time.
export function progressionFor(
  name: string,
  active: Workout | null | undefined,
  history: Workout[],
  exercises: PlannedExercise[] = [],
): Progression | null {
  const k = nameKey(name);
  const target = exercises.find((e) => nameKey(e.name) === k);
  if (!target || target.sets < 1) return null;
  // Only before the first set: after that each set follows the one before.
  if (active?.workout_sets.some((s) => nameKey(s.exercise_name) === k))
    return null;
  const last = lastTime(
    name,
    history.filter((w) => w.id !== active?.id),
  );
  if (last.length === 0 || setsDone(target, last) < target.sets) return null;

  const goalSeconds = plannedSeconds(target.reps);
  if (goalSeconds != null) {
    const times = last.map((s) => s.duration_seconds);
    if (times.some((t) => t == null || t < goalSeconds)) return null;
    const held = Math.min(...(times as number[]));
    const next = (Math.floor(held / TIME_STEP) + 1) * TIME_STEP;
    return {
      reason: `Every set lasted at least ${unit(held, "sec", "sec")} last time.`,
      label: `${next} sec`,
      prefill: { duration_seconds: next },
    };
  }

  const bottom = plannedReps(target.reps);
  const top = topReps(target.reps);
  if (bottom == null || top == null) return null;
  const reps = last.map((s) => s.reps);
  if (reps.some((r) => r == null || r < bottom)) return null;
  const fewest = Math.min(...(reps as number[]));
  const weights = last.map((s) => s.weight ?? 0);
  const weight = Math.min(...weights);
  const at = weight > 0 ? ` at ${weight} ${WEIGHT_UNIT}` : "";
  const reason = `Every set hit ${unit(fewest, "rep", "reps")}${at} last time.`;

  // The top of the range on every set: more weight, back to the bottom of the
  // range. Without weight, one more rep.
  if (fewest >= top && weight > 0) {
    const next = weight + WEIGHT_STEP;
    return {
      reason,
      label: `${next} ${WEIGHT_UNIT}`,
      prefill: { weight: next, reps: bottom },
    };
  }
  const next = fewest + 1;
  return {
    reason,
    label: unit(next, "rep", "reps"),
    prefill: { reps: next, ...(weight > 0 && { weight }) },
  };
}

// A set's starting numbers once a progression was taken: its reps or time
// for every set today, and its weight until the first set is done (after
// that the weight follows the set before, which already has it).
export function withProgression(
  base: Partial<SetInput>,
  taken: Partial<SetInput> | undefined,
  doneToday: boolean,
): Partial<SetInput> {
  if (!taken) return base;
  const { weight, ...rest } = taken;
  return {
    ...base,
    ...rest,
    ...(!doneToday && weight !== undefined && { weight }),
  };
}
