import type { PlannedExercise } from "../hooks/useWorkoutPlans";
import type { WorkoutSet } from "../hooks/useWorkouts";
import { sameName } from "./exerciseName";

// Exercises done back to back as a superset: one set of each in turn with no
// rest between, then rest after the round. Each group is a list of exercise
// names in the order they're done.
export type Supersets = string[][];

// A plan's supersets: exercises that share a "superset" letter.
export function planSupersets(exercises: PlannedExercise[]): Supersets {
  const groups = new Map<string, string[]>();
  for (const e of exercises) {
    const label = e.superset?.trim().toUpperCase();
    if (!label) continue;
    const group = groups.get(label) ?? [];
    if (!group.some((n) => sameName(n, e.name))) group.push(e.name);
    groups.set(label, group);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

export const supersetOf = (name: string, groups: Supersets) =>
  groups.find((g) => g.some((n) => sameName(n, name)));

// Puts two exercises (and anything already paired with them) in one superset.
export function joinSupersets(groups: Supersets, a: string, b: string) {
  const ga = supersetOf(a, groups) ?? [a];
  const gb = supersetOf(b, groups) ?? [b];
  if (ga === gb) return groups;
  const joined = [...ga, ...gb.filter((n) => !ga.some((m) => sameName(m, n)))];
  return [...groups.filter((g) => g !== ga && g !== gb), joined];
}

// Splits a superset just before `name`, so it and the exercises after it
// become their own superset (or a plain exercise when it's the last one).
export function splitSuperset(groups: Supersets, name: string) {
  const group = supersetOf(name, groups);
  const at = group?.findIndex((n) => sameName(n, name)) ?? -1;
  if (!group || at <= 0) return groups;
  return [
    ...groups.filter((g) => g !== group),
    group.slice(0, at),
    group.slice(at),
  ].filter((g) => g.length > 1);
}

// Takes one exercise out of its superset.
export const leaveSuperset = (groups: Supersets, name: string) =>
  groups
    .map((g) => g.filter((n) => !sameName(n, name)))
    .filter((g) => g.length > 1);

// Puts `to` in place of `from` wherever it's in a superset.
export const renameInSupersets = (
  groups: Supersets,
  from: string,
  to: string,
) => groups.map((g) => g.map((n) => (sameName(n, from) ? to : n)));

// Sets of an exercise done so far, where a left and a right make one set.
// Sets logged without a side count whole, and so does a lone side once the
// exercise is done both sides at once.
export function countSets(
  name: string,
  unilateral: boolean,
  sets: Pick<WorkoutSet, "exercise_name" | "side">[],
) {
  const mine = sets.filter((s) => sameName(s.exercise_name, name));
  const left = mine.filter((s) => s.side === "left").length;
  const right = mine.filter((s) => s.side === "right").length;
  const pairs = unilateral ? Math.min(left, right) : Math.max(left, right);
  return mine.length - left - right + pairs;
}

// What follows a set of `name` in its superset: the next exercise still
// behind in this round with no rest, or, once the round is done, rest and
// then the first exercise of the next round. `target` is how many sets an
// exercise has (Infinity when there's no plan); finished exercises drop out.
export function nextInSuperset(
  name: string,
  group: string[],
  done: (name: string) => number,
  target: (name: string) => number,
): { next: string | null; rest: boolean } {
  const at = group.findIndex((n) => sameName(n, name));
  // Everyone after this exercise, then around to it.
  const order = [...group.slice(at + 1), ...group.slice(0, at + 1)];
  const open = order.filter((n) => done(n) < target(n));
  if (open.length === 0) return { next: null, rest: true };
  const count = done(name);
  const behind = open.find((n) => !sameName(n, name) && done(n) < count);
  if (behind) return { next: behind, rest: false };
  // Wrapped so map's index never reaches `done` as a second argument.
  const fewest = Math.min(...open.map((n) => done(n)));
  return { next: open.find((n) => done(n) === fewest)!, rest: true };
}
