import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { doneSet, exercise, renderWorkout } from "../../test/workoutHarness";

type User = ReturnType<typeof userEvent.setup>;

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const dialog = () => within(screen.getByRole("dialog"));

const openOptions = (user: User, name: string) =>
  user.click(button(`${name} options`));

// Opens the exercise's Edit form and types over the given fields.
async function edit(
  user: User,
  name: string,
  fields: Partial<Record<"Exercise" | "Sets" | "Reps" | "Weight", string>>,
) {
  await openOptions(user, name);
  await user.click(dialog().getByRole("button", { name: "Edit exercise" }));
  const labels = {
    Exercise: "Exercise",
    Sets: "Sets",
    Reps: "Reps or time per set",
    Weight: /^Weight in/,
  };
  for (const [field, value] of Object.entries(fields)) {
    const input = dialog().getByLabelText(labels[field as keyof typeof labels]);
    await user.clear(input);
    await user.type(input, value);
  }
  await user.click(dialog().getByRole("button", { name: "Save" }));
}

describe("editing an exercise mid-workout", () => {
  it("adds and takes away a set from the Options drawer", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat", { sets: 3 }), exercise("Bench")],
      [doneSet("Squat"), doneSet("Squat")],
    );
    render(<w.Harness />);
    expect(screen.getByText(/Set 3 of 3/)).toBeInTheDocument();

    await openOptions(user, "Squat");
    await user.click(dialog().getByRole("button", { name: "One more set" }));
    expect(dialog().getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/Set 3 of 4/)).toBeInTheDocument();
    expect(w.workout().plan_changes?.sets).toEqual({ 0: 4 });

    await user.click(dialog().getByRole("button", { name: "One set fewer" }));
    await user.click(dialog().getByRole("button", { name: "One set fewer" }));
    expect(w.workout().plan_changes?.sets).toEqual({ 0: 2 });
    // That made it done: on to Bench. Two are done already, so it won't go
    // below that.
    expect(screen.getByText("Done")).toBeInTheDocument();
    await openOptions(user, "Squat");
    expect(
      dialog().getByRole("button", { name: "One set fewer" }),
    ).toBeDisabled();
  });

  it("changes a superset's rounds from any of its exercises", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Push-up", { sets: 2, superset: "A" }),
      exercise("Row", { sets: 2, superset: "A" }),
    ]);
    render(<w.Harness />);

    await openOptions(user, "Row");
    await user.click(dialog().getByRole("button", { name: "One more round" }));
    expect(screen.getByText(/Superset · Round 1 of 3/)).toBeInTheDocument();
    expect(w.workout().plan_changes?.sets).toEqual({ 0: 3, 1: 3 });
  });

  it("edits the reps, weight and sets, just this workout", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Squat", { sets: 3, reps: "8", weight: 100 }),
      exercise("Bench"),
    ]);
    render(<w.Harness />);

    await edit(user, "Squat", { Sets: "5", Reps: "6", Weight: "120" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Set 1 of 5 · 6 at 120 lb/)).toBeInTheDocument();
    expect(w.workout().plan_changes?.edits?.[0]).toMatchObject({
      reps: "6",
      weight: 120,
    });

    // The next set starts at the new numbers.
    await user.click(button("Start"));
    await user.click(button("Finish"));
    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      exercise_name: "Squat",
      reps: 6,
      weight: 120,
    });
  });

  it("starts the next set at a new weight even after a set at the old one", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat", { sets: 3, weight: 100 })],
      [doneSet("Squat", { weight: 100 })],
    );
    render(<w.Harness />);

    await edit(user, "Squat", { Weight: "110" });
    await user.click(button("Start"));
    await user.click(button("Finish"));

    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({ weight: 110 });
  });

  it("renames it, keeping the numbers typed", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Squat", { sets: 3, weight: 100 }),
      exercise("Bench"),
    ]);
    render(<w.Harness />);

    await edit(user, "Squat", { Exercise: "Front squat" });

    expect(button("Front squat options")).toBeInTheDocument();
    expect(screen.getByText("Instead of Squat")).toBeInTheDocument();
    expect(screen.getByText(/Set 1 of 3 · 8 at 100 lb/)).toBeInTheDocument();
  });

  it("keeps the set going when the exercise is edited mid-set", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat", { sets: 3 })]);
    render(<w.Harness />);

    await user.click(button("Start"));
    await edit(user, "Squat", { Exercise: "Front squat", Weight: "60" });
    await user.click(button("Finish"));

    expect(w.onAddSet.mock.calls[0][0]).toMatchObject({
      exercise_name: "Front squat",
    });
  });
});
