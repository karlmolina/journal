import { describe, expect, it } from "vitest";
import type { PlannedExercise } from "../hooks/useWorkoutPlans";
import type { Workout, WorkoutSet } from "../hooks/useWorkouts";
import {
  applyPlanChanges,
  currentExerciseIndex,
  endExercise,
  moveExercise,
  nextSessionIndex,
  nextSide,
  plannedReps,
  plannedSeconds,
  setSides,
  swapExercise,
  workoutOrder,
} from "./planProgress";

const ex = (name: string, more: Partial<PlannedExercise> = {}) => ({
  name,
  sets: 2,
  reps: "8",
  rest_seconds: 60,
  notes: "",
  ...more,
});
const set = (exercise_name: string, side: WorkoutSet["side"] = null) =>
  ({ exercise_name, side }) as WorkoutSet;

describe("plannedReps and plannedSeconds", () => {
  it("reads reps from a rep range", () => {
    expect(plannedReps("8-10")).toBe(8);
    expect(plannedReps("12")).toBe(12);
  });
  it("gives no reps for timed or distance targets", () => {
    expect(plannedReps("30 sec")).toBeNull();
    expect(plannedReps("400 m")).toBeNull();
    expect(plannedReps("1:30")).toBeNull();
  });
  it("reads times", () => {
    expect(plannedSeconds("15 min")).toBe(900);
    expect(plannedSeconds("30-45 sec")).toBe(30);
    expect(plannedSeconds("1:30")).toBe(90);
    expect(plannedSeconds("8-10")).toBeNull();
  });
});

describe("currentExerciseIndex", () => {
  const plan = [ex("Squat"), ex("Lunge", { unilateral: true })];
  it("is the first exercise with sets to go", () => {
    expect(currentExerciseIndex(plan, [])).toBe(0);
    expect(currentExerciseIndex(plan, [set("Squat"), set("squat ")])).toBe(1);
  });
  it("counts a one-sided set once both sides are done", () => {
    const sets = [set("Squat"), set("Squat"), set("Lunge", "right")];
    expect(currentExerciseIndex(plan, sets)).toBe(1);
    sets.push(set("Lunge", "left"), set("Lunge", "right"));
    expect(currentExerciseIndex(plan, sets)).toBe(1);
    sets.push(set("Lunge", "left"));
    expect(currentExerciseIndex(plan, sets)).toBeNull();
  });
});

describe("nextSide", () => {
  it("starts on the right, then evens up with the left", () => {
    expect(nextSide("Lunge", [])).toBe("right");
    expect(nextSide("Lunge", [set("Lunge", "right")])).toBe("left");
    expect(
      nextSide("Lunge", [set("Lunge", "right"), set("Lunge", "left")]),
    ).toBe("right");
  });
});

describe("nextSessionIndex", () => {
  const plan = (id: string, revised_from: string | null = null) => ({
    id,
    revised_from,
    plan: { sessions: [{}, {}, {}] },
  });
  const workout = (plan_id: string, plan_session: number) =>
    ({ plan_id, plan_session }) as Workout;

  it("is the day after the last one done, wrapping around", () => {
    const p = plan("p1");
    // @ts-expect-error only the fields it reads
    expect(nextSessionIndex(p, [p], [])).toBe(0);
    // @ts-expect-error only the fields it reads
    expect(nextSessionIndex(p, [p], [workout("p1", 1)])).toBe(2);
    // @ts-expect-error only the fields it reads
    expect(nextSessionIndex(p, [p], [workout("p1", 2)])).toBe(0);
  });
  it("counts workouts done on an earlier version of the plan", () => {
    const old = plan("p1");
    const revised = plan("p2", "p1");
    // @ts-expect-error only the fields it reads
    expect(nextSessionIndex(revised, [old, revised], [workout("p1", 0)])).toBe(
      1,
    );
  });
});

describe("plan changes for one workout", () => {
  const day = [ex("Squat", { weight: 100 }), ex("Row"), ex("Plank")];

  it("swaps an exercise, keeping sets and rest but not weight", () => {
    const changes = swapExercise(null, 0, "Goblet squat", "Squat");
    const [first] = applyPlanChanges(day, changes);
    expect(first).toMatchObject({
      name: "Goblet squat",
      sets: 2,
      rest_seconds: 60,
      swapped_from: "Squat",
    });
    expect(first.weight).toBeUndefined();
  });

  it("swapping back to the plan's exercise undoes the swap", () => {
    const swapped = swapExercise(null, 0, "Goblet squat", "Squat");
    const back = swapExercise(swapped, 0, "squat", "Squat");
    expect(applyPlanChanges(day, back)[0].name).toBe("Squat");
  });

  it("ends an exercise early, and picks it back up", () => {
    const ended = endExercise(null, 1, true);
    expect(applyPlanChanges(day, ended)[1].ended).toBe(true);
    expect(applyPlanChanges(day, endExercise(ended, 1, false))[1].ended).toBe(
      undefined,
    );
  });

  it("switches sides just for today, and back", () => {
    const one = setSides(null, 2, true, false);
    expect(applyPlanChanges(day, one)[2]).toMatchObject({
      unilateral: true,
      sides_changed: true,
    });
    expect(setSides(one, 2, false, false).sides).toEqual({});
  });

  it("puts today's order first, then anything left out", () => {
    expect(workoutOrder({ order: [2, 0, 2, 9] }, 3)).toEqual([2, 0, 1]);
    const names = applyPlanChanges(day, { order: [2, 0, 1] }).map(
      (e) => e.name,
    );
    expect(names).toEqual(["Plank", "Squat", "Row"]);
  });
});

describe("moveExercise", () => {
  it("moves a superset as a whole past its neighbor", () => {
    const day = [
      ex("Squat"),
      ex("Push-up", { superset: "A" }),
      ex("Row", { superset: "a" }),
    ];
    const moved = moveExercise(day, 0, 1);
    expect(moved?.exercises.map((e) => e.name)).toEqual([
      "Push-up",
      "Row",
      "Squat",
    ]);
    expect(moved?.from).toEqual([1, 2, 0]);
  });
  it("moves within a superset past its partner", () => {
    const day = [
      ex("Push-up", { superset: "A" }),
      ex("Row", { superset: "A" }),
    ];
    expect(moveExercise(day, 1, -1)?.exercises.map((e) => e.name)).toEqual([
      "Row",
      "Push-up",
    ]);
  });
  it("can't move past the ends", () => {
    expect(moveExercise([ex("Squat"), ex("Row")], 0, -1)).toBeNull();
  });
});
