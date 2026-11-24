import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "../hooks/useWorkouts";
import { restVsActive } from "./workoutSets";

const set = (duration_seconds: number | null): WorkoutSet =>
  ({ duration_seconds }) as WorkoutSet;

describe("restVsActive", () => {
  it("counts set clocks as active and the rest of the workout as rest", () => {
    expect(restVsActive(600, [set(40), set(45), set(null), set(35)])).toEqual({
      active: 120,
      rest: 480,
    });
  });

  it("is null when no set was timed", () => {
    expect(restVsActive(600, [set(null)])).toBeNull();
    expect(restVsActive(600, [])).toBeNull();
  });

  it("never shows more active time than the workout lasted", () => {
    expect(restVsActive(60, [set(90)])).toEqual({ active: 60, rest: 0 });
  });
});
