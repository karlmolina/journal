import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Workout } from "../../hooks/useWorkouts";
import { doneSet, exercise, renderWorkout } from "../../test/workoutHarness";

const lastTime = (reps: number): Workout => ({
  id: "last",
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
  workout_sets: [
    doneSet("Squat", { reps, weight: 100 }),
    doneSet("Squat", { reps, weight: 100 }),
  ],
});
const squat = [exercise("Squat", { sets: 2, reps: "8", weight: 100 })];

describe("progression nudge", () => {
  it("is only a suggestion: ignored, the set starts as usual", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(squat, [], null, [lastTime(8)]);
    render(<w.Harness />);

    expect(
      screen.getByText("Every set hit 8 reps at 100 lb last time."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({ weight: 100 });
  });

  it("starts the set at the new weight once taken, and can be undone", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(squat, [], null, [lastTime(8)]);
    render(<w.Harness />);

    await user.click(screen.getByRole("button", { name: "Try 105 lb" }));
    expect(screen.getByText(/Going up to/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Try 105 lb" }));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      weight: 105,
      reps: 8,
    });
    // Gone after the first set: the next follows the one before.
    expect(screen.queryByText(/Going up to/)).not.toBeInTheDocument();
  });

  it("doesn't show when a set fell short last time", () => {
    const w = renderWorkout(squat, [], null, [lastTime(6)]);
    render(<w.Harness />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
