import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { doneSet, exercise, renderWorkout } from "../../test/workoutHarness";

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const noButton = (name: string | RegExp) =>
  expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();

// Starts the current exercise's set and finishes it.
async function doSet(
  user: ReturnType<typeof userEvent.setup>,
  start = "Start",
) {
  await user.click(button(start));
  await user.click(button("Finish"));
}

describe("active workout", () => {
  it("saves a set on Finish and offers the rest before the next one", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 2 })]);
    render(<w.Harness />);

    await doSet(user);

    expect(w.onAddSet).toHaveBeenCalledTimes(1);
    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      exercise_name: "Squat",
      reps: 8,
    });
    expect(button("Rest")).toBeInTheDocument();
    await user.click(button("Rest"));
    expect(screen.getAllByText("Resting").length).toBeGreaterThan(0);
  });

  it("goes back to the running set with Back to the set", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 2 })]);
    render(<w.Harness />);

    await doSet(user);
    expect(w.sets()).toHaveLength(1);

    await user.click(button(/Back to the set/));

    // The set just saved comes back out, and its clock keeps going.
    expect(w.onRemoveSets).toHaveBeenCalledTimes(1);
    expect(w.sets()).toHaveLength(0);
    expect(button("Finish")).toBeInTheDocument();
    noButton("Rest");

    // Finishing again saves it once more.
    await user.click(button("Finish"));
    expect(w.sets()).toHaveLength(1);
    expect(button("Rest")).toBeInTheDocument();
  });

  it("goes back to the set after the plan's last set too", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 1 })]);
    render(<w.Harness />);

    await doSet(user);
    expect(button("Done")).toBeInTheDocument();

    await user.click(button(/Back to the set/));
    expect(w.sets()).toHaveLength(0);
    expect(button("Finish")).toBeInTheDocument();
    expect(
      screen.queryByText(/Every planned set is done/),
    ).not.toBeInTheDocument();
  });

  it("ends the plan's last set with Done, not a rest", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat", { sets: 1 }), exercise("Plank", { sets: 1 })],
      [doneSet("Squat")],
    );
    render(<w.Harness />);

    await doSet(user);

    expect(button("Done")).toBeInTheDocument();
    noButton("Rest");

    await user.click(button("Done"));
    expect(screen.getByText(/Every planned set is done/)).toBeInTheDocument();
    expect(button("Finish workout")).toBeInTheDocument();
    // No rest and no start button for a set that isn't there.
    expect(screen.queryByText("Resting")).not.toBeInTheDocument();
    noButton("Start");
  });

  it("rests between exercises when it isn't the last set", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Squat", { sets: 1 }),
      exercise("Plank", { sets: 1 }),
    ]);
    render(<w.Harness />);

    await doSet(user);
    expect(button("Rest")).toBeInTheDocument();
    noButton("Done");
  });

  it("goes straight on to the next exercise in a superset", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Push-up", { sets: 2, superset: "A" }),
      exercise("Row", { sets: 2, superset: "A" }),
    ]);
    render(<w.Harness />);

    await doSet(user);
    expect(button("Next exercise")).toBeInTheDocument();
    noButton("Rest");

    // The countdown into the next exercise, which can start right away.
    await user.click(button("Next exercise"));
    await user.click(button("Start now"));
    await user.click(button("Finish"));
    expect(w.sets().map((s) => s.exercise_name)).toEqual(["Push-up", "Row"]);
    // The round is done: now the rest.
    expect(button("Rest")).toBeInTheDocument();
  });

  it("does the right side, then the left, before resting", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Lunge", { sets: 2, unilateral: true })]);
    render(<w.Harness />);

    await doSet(user, "Start right side");
    expect(w.sets()[0].side).toBe("right");
    expect(button("Start left side")).toBeInTheDocument();
  });
});
