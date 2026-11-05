import { describe, expect, it } from "vitest";
import {
  countSets,
  joinSupersets,
  leaveSuperset,
  nextInSuperset,
  planSupersets,
  splitSuperset,
} from "./supersets";

const sets = (...names: [string, ("left" | "right" | null)?][]) =>
  names.map(([exercise_name, side = null]) => ({ exercise_name, side }));

describe("planSupersets", () => {
  it("groups exercises sharing a letter, ignoring case", () => {
    expect(
      planSupersets([
        { name: "Push-up", superset: "a" },
        { name: "Squat" },
        { name: "Row", superset: "A " },
        { name: "Plank", superset: "B" },
      ] as never),
    ).toEqual([["Push-up", "Row"]]);
  });
});

describe("joining and splitting", () => {
  it("joins two exercises and anything already with them", () => {
    expect(joinSupersets([["A", "B"]], "B", "C")).toEqual([["A", "B", "C"]]);
  });
  it("splits before an exercise", () => {
    expect(splitSuperset([["A", "B", "C", "D"]], "C")).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(splitSuperset([["A", "B", "C"]], "C")).toEqual([["A", "B"]]);
  });
  it("leaves a superset, dropping groups of one", () => {
    expect(leaveSuperset([["A", "B"]], "a")).toEqual([]);
  });
});

describe("countSets", () => {
  it("counts a left and a right as one set when one-sided", () => {
    const done = sets(["Lunge", "left"], ["Lunge", "right"], ["Lunge", "left"]);
    expect(countSets("Lunge", true, done)).toBe(1);
    expect(countSets("Lunge", false, done)).toBe(2);
  });
});

describe("nextInSuperset", () => {
  const group = ["Push-up", "Row"];
  const target = () => 2;
  const doneIn = (done: Record<string, number>) => (n: string) => done[n] ?? 0;

  it("goes on to the partner with no rest mid-round", () => {
    expect(
      nextInSuperset("Push-up", group, doneIn({ "Push-up": 1 }), target),
    ).toEqual({ next: "Row", rest: false });
  });
  it("rests after the round, then starts the next one", () => {
    expect(
      nextInSuperset("Row", group, doneIn({ "Push-up": 1, Row: 1 }), target),
    ).toEqual({ next: "Push-up", rest: true });
  });
  it("has nothing next once every set is done", () => {
    expect(
      nextInSuperset("Row", group, doneIn({ "Push-up": 2, Row: 2 }), target),
    ).toEqual({ next: null, rest: true });
  });
  it("skips a finished partner", () => {
    expect(
      nextInSuperset("Row", group, doneIn({ "Push-up": 2, Row: 1 }), target),
    ).toEqual({ next: "Row", rest: true });
  });
});
