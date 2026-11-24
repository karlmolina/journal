import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { doneSet, exercise, renderWorkout } from "../../test/workoutHarness";

// The exercise cards' titles, top to bottom.
const cards = () =>
  screen
    .getAllByRole("button", { name: / options$/ })
    .map((b) => b.textContent);

const openOptions = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("button", { name: `${name} options` }));

describe("adding an exercise anywhere in a workout", () => {
  it("adds one right after the exercise whose Options it came from", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Squat"),
      exercise("Bench"),
      exercise("Lunge"),
    ]);
    render(<w.Harness />);

    await openOptions(user, "Squat");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add an exercise after this",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.type(screen.getByLabelText("Exercise"), "Curl");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(cards()).toEqual(["Squat", "Curl", "Bench", "Lunge"]);
    expect(w.onAddExercise).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Curl" }),
      false,
      0,
    );
    // Squat is still the one you're on.
    expect(
      screen.getByRole("button", { name: "Squat options" }).className,
    ).toMatch(/text-4xl/);
  });

  it("keeps you on the current exercise when one goes in above it", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat"), exercise("Bench"), exercise("Lunge")],
      [doneSet("Squat"), doneSet("Squat"), doneSet("Bench")],
    );
    render(<w.Harness />);
    const current = () =>
      screen
        .getAllByRole("button", { name: / options$/ })
        .find((b) => /text-4xl/.test(b.className))?.textContent;
    expect(current()).toBe("Bench");

    await openOptions(user, "Squat");
    await user.click(
      screen.getByRole("button", { name: "Add an exercise after this" }),
    );
    await user.type(screen.getByLabelText("Exercise"), "Curl");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(cards()).toEqual(["Squat", "Curl", "Bench", "Lunge"]);
    expect(current()).toBe("Bench");
  });

  it("goes after a whole superset, not into the middle of it", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat"), exercise("Curl"), exercise("Press")],
      [],
      [["Squat", "Curl"]],
    );
    render(<w.Harness />);

    await openOptions(user, "Squat");
    await user.click(
      screen.getByRole("button", { name: "Add an exercise after this" }),
    );
    await user.type(screen.getByLabelText("Exercise"), "Dip");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(cards()).toEqual(["Squat", "Curl", "Dip", "Press"]);
  });

  it("still adds at the end from the button under the list", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat"), exercise("Bench")]);
    render(<w.Harness />);

    await user.click(screen.getByRole("button", { name: "+ Add exercise" }));
    await user.type(screen.getByLabelText("Exercise"), "Curl");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(cards()).toEqual(["Squat", "Bench", "Curl"]);
  });
});
