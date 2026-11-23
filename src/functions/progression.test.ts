import { describe, expect, it } from "vitest";
import type { Workout, WorkoutSet } from "../hooks/useWorkouts";
import { doneSet, exercise } from "../test/workoutHarness";
import { progressionFor, topReps, withProgression } from "./progression";

const workout = (id: string, sets: WorkoutSet[]): Workout => ({
  id,
  started_at: "2026-11-20T10:00:00Z",
  paused_at: null,
  paused_seconds: 0,
  ended_at: "2026-11-20T10:30:00Z",
  notes: null,
  activity: null,
  plan_id: "p1",
  plan_session: 0,
  supersets: null,
  plan_changes: null,
  workout_sets: sets,
});
const today = (sets: WorkoutSet[] = []) => workout("today", sets);
const sets = (n: number, more: Partial<WorkoutSet>) =>
  Array.from({ length: n }, () => doneSet("Squat", more));

describe("topReps", () => {
  it("takes the top of a range", () => {
    expect(topReps("8-10")).toBe(10);
    expect(topReps("12")).toBe(12);
    expect(topReps("30 sec")).toBeNull();
  });
});

describe("progressionFor", () => {
  const squat = exercise("Squat", { sets: 3, reps: "8-10", weight: 100 });

  it("adds weight when every set hit the top of the range", () => {
    const last = workout("a", sets(3, { reps: 10, weight: 100 }));
    expect(progressionFor("Squat", today(), [last], [squat])).toEqual({
      reason: "Every set hit 10 reps at 100 lb last time.",
      label: "105 lb",
      prefill: { weight: 105, reps: 8 },
    });
  });

  it("adds a rep when every set hit the range but not its top", () => {
    const last = workout("a", [
      ...sets(2, { reps: 9, weight: 100 }),
      doneSet("Squat", { reps: 8, weight: 100 }),
    ]);
    expect(progressionFor("Squat", today(), [last], [squat])).toMatchObject({
      label: "9 reps",
      prefill: { reps: 9, weight: 100 },
    });
  });

  it("adds a rep to a bodyweight exercise at the top", () => {
    const pushUp = exercise("Push-up", { sets: 2, reps: "12" });
    const last = workout("a", [
      doneSet("Push-up", { reps: 12 }),
      doneSet("Push-up", { reps: 13 }),
    ]);
    expect(progressionFor("Push-up", today(), [last], [pushUp])).toMatchObject({
      label: "13 reps",
      prefill: { reps: 13 },
    });
  });

  it("adds time to a hold when every set lasted the plan's time", () => {
    const plank = exercise("Plank", { sets: 2, reps: "30 sec" });
    const last = workout("a", [
      doneSet("Plank", { duration_seconds: 33 }),
      doneSet("Plank", { duration_seconds: 31 }),
    ]);
    expect(progressionFor("Plank", today(), [last], [plank])).toMatchObject({
      label: "35 sec",
      prefill: { duration_seconds: 35 },
    });
  });

  it("says nothing when a set fell short or sets were missed", () => {
    const short = workout("a", [
      ...sets(2, { reps: 10, weight: 100 }),
      doneSet("Squat", { reps: 6, weight: 100 }),
    ]);
    expect(progressionFor("Squat", today(), [short], [squat])).toBeNull();
    const missed = workout("a", sets(2, { reps: 10, weight: 100 }));
    expect(progressionFor("Squat", today(), [missed], [squat])).toBeNull();
  });

  it("only looks at the last time the exercise was done", () => {
    const short = workout("b", sets(3, { reps: 6, weight: 100 }));
    const good = workout("a", sets(3, { reps: 10, weight: 100 }));
    const other = workout("c", [doneSet("Bench", { reps: 5 })]);
    expect(
      progressionFor("Squat", today(), [other, short, good], [squat]),
    ).toBeNull();
  });

  it("goes once today's first set is done, and needs a plan target", () => {
    const last = workout("a", sets(3, { reps: 10, weight: 100 }));
    expect(
      progressionFor("Squat", today(sets(1, { reps: 8 })), [last], [squat]),
    ).toBeNull();
    expect(progressionFor("Squat", today(), [last], [])).toBeNull();
  });

  it("counts a one-side exercise's sets once both sides are done", () => {
    const lunge = exercise("Lunge", { sets: 2, reps: "8", unilateral: true });
    const side = (s: "left" | "right") =>
      doneSet("Lunge", { reps: 8, weight: 20, side: s });
    const half = workout("a", [side("right"), side("left"), side("right")]);
    expect(progressionFor("Lunge", today(), [half], [lunge])).toBeNull();
    const all = workout("a", [...half.workout_sets, side("left")]);
    expect(progressionFor("Lunge", today(), [all], [lunge])).toMatchObject({
      label: "25 lb",
    });
  });
});

describe("withProgression", () => {
  const base = { reps: 8, weight: 100, duration_seconds: null };

  it("starts the first set with the new numbers", () => {
    expect(withProgression(base, { weight: 105, reps: 8 }, false)).toEqual({
      reps: 8,
      weight: 105,
      duration_seconds: null,
    });
  });

  it("keeps new reps after the first set, and leaves weight to it", () => {
    expect(withProgression(base, { weight: 100, reps: 9 }, true)).toEqual({
      reps: 9,
      weight: 100,
      duration_seconds: null,
    });
    expect(withProgression(base, undefined, false)).toBe(base);
  });
});
