import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("starts a set at the weight of the last set done of it", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat", { sets: 3, weight: 100 })],
      [doneSet("Squat", { weight: 120 })],
    );
    render(<w.Harness />);

    await doSet(user);

    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      exercise_name: "Squat",
      weight: 120,
    });
  });

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

  it("adds and removes a circuit's rounds", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Push-up", { sets: 2, superset: "A" }),
      exercise("Row", { sets: 2, superset: "A" }),
      exercise("Plank", { sets: 2, superset: "A" }),
    ]);
    render(<w.Harness />);
    expect(screen.getByText(/Circuit · Round 1 of 2/)).toBeInTheDocument();

    await user.click(button("One more round"));
    expect(screen.getByText(/Circuit · Round 1 of 3/)).toBeInTheDocument();
    await user.click(button("One round fewer"));
    await user.click(button("One round fewer"));
    expect(screen.getByText(/Circuit · Round 1 of 1/)).toBeInTheDocument();
    // Never fewer than one round.
    expect(button("One round fewer")).toBeDisabled();
  });

  it("won't take away rounds already done", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [
        exercise("Push-up", { sets: 3, superset: "A" }),
        exercise("Row", { sets: 3, superset: "A" }),
      ],
      [
        doneSet("Push-up"),
        doneSet("Row"),
        doneSet("Push-up"),
        doneSet("Row"),
      ],
    );
    render(<w.Harness />);
    expect(screen.getByText(/Superset · Round 3 of 3/)).toBeInTheDocument();

    await user.click(button("One round fewer"));
    // Two rounds were done, so the superset is now done too.
    expect(screen.getByText(/Superset · Done/)).toBeInTheDocument();
    expect(button("One round fewer")).toBeDisabled();
    await user.click(button("One more round"));
    expect(screen.getByText(/Superset · Round 3 of 3/)).toBeInTheDocument();
  });

  it("does the right side, then the left, before resting", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Lunge", { sets: 2, unilateral: true })]);
    render(<w.Harness />);

    await doSet(user, "Start right side");
    expect(w.sets()[0].side).toBe("right");
    expect(button("Start left side")).toBeInTheDocument();
  });

  it("drags the running set's reps right away", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 2 })]);
    render(<w.Harness />);
    await user.click(button("Start"));

    const reps = screen.getByRole("textbox", { name: "Reps" });
    expect(reps).toHaveValue("8");
    Element.prototype.setPointerCapture ??= () => {};
    // jsdom's pointer events leave out clientY: mouse events stand in.
    for (const [type, clientY] of [
      ["pointerdown", 100],
      ["pointermove", 200],
      ["pointermove", 300],
    ] as const) {
      const event = new MouseEvent(type, { bubbles: true, clientY });
      Object.assign(event, { pointerId: 1, pointerType: "touch" });
      fireEvent(reps.closest("label")!, event);
    }
    expect(Number((reps as HTMLInputElement).value)).toBeGreaterThan(8);
  });

  it("stops a set going without saving it", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 2 })]);
    render(<w.Harness />);

    await user.click(button("Start"));
    await user.click(button("Stop without saving"));

    expect(w.onAddSet).not.toHaveBeenCalled();
    expect(button("Start")).toBeInTheDocument();
    noButton("Finish");
  });

  it("goes back to the rest when a set after it is stopped", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 3 })]);
    render(<w.Harness />);

    await doSet(user);
    await user.click(button("Rest"));
    await user.click(button("Start"));
    await user.click(button("Stop without saving"));

    expect(w.sets()).toHaveLength(1);
    expect(screen.getAllByText("Resting").length).toBeGreaterThan(0);
    expect(button("Start")).toBeInTheDocument();
  });

  it("switches to another exercise mid-set with Do this now", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat"), exercise("Bench press")]);
    render(<w.Harness />);

    await user.click(button("Start"));
    await user.click(button("Bench press options"));
    expect(
      screen.getByText("Your Squat set stops without saving."),
    ).toBeInTheDocument();
    await user.click(button("Do this now"));

    expect(w.onAddSet).not.toHaveBeenCalled();
    await doSet(user);
    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      exercise_name: "Bench press",
    });
  });

  it("swaps from the drawer in one tap on a suggestion", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat"), exercise("Bench press")]);
    render(<w.Harness />);

    await user.click(button("Squat options"));
    await user.click(screen.getByPlaceholderText("Swap for…"));
    await user.click(
      within(screen.getByRole("listbox")).getByRole("button", {
        name: "Goblet squat",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Instead of Squat")).toBeInTheDocument();
  });

  it("swaps the exercise mid-set and keeps the set going as the new one", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat"), exercise("Bench press")]);
    render(<w.Harness />);

    await user.click(button("Start"));
    await user.click(button("Squat options"));
    // Ending it waits until the set is done.
    noButton("End early");
    // The drawer has the swap field right in it.
    await user.type(screen.getByPlaceholderText("Swap for…"), "Goblet squat");
    await user.click(button("Swap"));

    expect(button("Finish")).toBeInTheDocument();
    await user.click(button("Finish"));
    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      exercise_name: "Goblet squat",
    });
  });

  it("adds a note from the drawer, not from the exercise's header", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat"), exercise("Bench press")]);
    render(<w.Harness />);

    noButton("+ Add a note");
    await user.click(button("Bench press options"));
    await user.click(button("Add a note"));
    await user.type(
      screen.getByPlaceholderText(/A cue that helps/),
      "Elbows tucked",
    );
    await user.click(button("Save note"));

    expect(w.onAddNote).toHaveBeenCalledWith(
      "Bench press",
      "Elbows tucked",
      null,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
