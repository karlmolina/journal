import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpNext } from "./Session";
import type { PlannedExercise, WorkoutPlan } from "../../hooks/useWorkoutPlans";

const ex = (name: string, more: Partial<PlannedExercise> = {}) => ({
  name,
  sets: 3,
  reps: "10",
  rest_seconds: 60,
  notes: "",
  ...more,
});

const plan = {
  id: "p1",
  plan: {
    title: "Strength",
    summary: "",
    safety_notes: [],
    sessions: [
      {
        day: "",
        focus: "Legs",
        duration_minutes: 30,
        exercises: [
          ex("Goblet squat", { weight: 40 }),
          ex("Wall sit", { reps: "45s", superset: "A" }),
          ex("Calf raise", { superset: "A" }),
        ],
      },
      {
        day: "",
        focus: "Push",
        duration_minutes: 30,
        exercises: [ex("Push-up")],
      },
    ],
  },
} as unknown as WorkoutPlan;

const renderUpNext = (onStart: (session: number) => void = () => {}) =>
  render(
    <UpNext plan={plan} next={0} lookup={() => undefined} onStart={onStart} />,
  );

describe("Up next plan day", () => {
  it("lists the day's exercises when the day is tapped", async () => {
    renderUpNext();
    expect(screen.queryByText("Goblet squat")).not.toBeInTheDocument();

    const day = screen.getByRole("button", { name: /Day 1: Legs/ });
    expect(day).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(day);

    expect(day).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Day 1 exercises" });
    expect(list).toHaveTextContent("Goblet squat");
    expect(list).toHaveTextContent("3 × 10 · 40 lb · rest 60s");
    expect(list).toHaveTextContent("Superset");
    expect(list).toHaveTextContent("Wall sit");
    expect(list).toHaveTextContent("Calf raise");

    await userEvent.click(day);
    expect(screen.queryByText("Goblet squat")).not.toBeInTheDocument();
  });

  it("keeps the list open for another chosen day, and Start still starts", async () => {
    const started: number[] = [];
    renderUpNext((i) => {
      started.push(i);
    });
    await userEvent.click(screen.getByRole("button", { name: /Day 1: Legs/ }));
    await userEvent.click(screen.getByRole("button", { name: "Day 2" }));

    expect(
      screen.getByRole("list", { name: "Day 2 exercises" }),
    ).toHaveTextContent("Push-up");
    await userEvent.click(screen.getByRole("button", { name: "Start Day 2" }));
    expect(started).toEqual([1]);
  });
});
