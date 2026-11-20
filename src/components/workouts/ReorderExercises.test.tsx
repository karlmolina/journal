import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { exercise, renderWorkout } from "../../test/workoutHarness";
import { dropIndex } from "../../hooks/useDragSort";

// jsdom has no pointer events; a mouse event with a pointer id will do.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType = "touch";
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
window.PointerEvent ??= FakePointerEvent as unknown as typeof PointerEvent;

// jsdom lays nothing out, so each item stands 100px below the one before it.
const ROW = 100;
beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const k = this.parentElement
        ? [...this.parentElement.children].indexOf(this)
        : 0;
      return DOMRect.fromRect({ x: 0, y: k * ROW, width: 300, height: 90 });
    },
  );
});
afterEach(() => vi.restoreAllMocks());

const order = () =>
  within(screen.getByRole("list", { name: "Exercise order" }))
    .getAllByRole("button", { name: /^Drag .* to move it$/ })
    .map((b) => b.getAttribute("aria-label")!.slice(5, -11));

// Picks an item up by its handle and lets go `dy` px lower.
function drag(name: string, dy: number) {
  const grip = screen.getByRole("button", { name: `Drag ${name} to move it` });
  fireEvent.pointerDown(grip, { pointerId: 1, clientY: 0, button: 0 });
  fireEvent.pointerMove(grip, { pointerId: 1, clientY: dy });
  fireEvent.pointerUp(grip, { pointerId: 1, clientY: dy });
}

describe("reordering a workout's exercises", () => {
  it("drags an exercise to a new place", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([
      exercise("Squat"),
      exercise("Bench"),
      exercise("Lunge"),
    ]);
    render(<w.Harness />);
    await user.click(screen.getByRole("button", { name: "Reorder" }));

    drag("Lunge", -2.2 * ROW);
    expect(order()).toEqual(["Lunge", "Squat", "Bench"]);

    drag("Lunge", 1.2 * ROW);
    expect(order()).toEqual(["Squat", "Lunge", "Bench"]);

    await user.click(screen.getByRole("button", { name: "Done moving" }));
    expect(screen.queryByRole("list", { name: "Exercise order" })).toBeNull();
  });

  it("leaves the order alone when an exercise isn't dragged far enough", async () => {
    const user = userEvent.setup();
    const w = renderWorkout([exercise("Squat"), exercise("Bench")]);
    render(<w.Harness />);
    await user.click(screen.getByRole("button", { name: "Reorder" }));

    drag("Squat", 0.4 * ROW);
    expect(order()).toEqual(["Squat", "Bench"]);
  });

  it("moves a superset as one and its exercises within it", async () => {
    const user = userEvent.setup();
    const w = renderWorkout(
      [exercise("Squat"), exercise("Curl"), exercise("Press")],
      [],
      [["Curl", "Press"]],
    );
    render(<w.Harness />);
    await user.click(screen.getByRole("button", { name: "Reorder" }));

    drag("Press", -1.2 * ROW);
    expect(order()).toEqual(["Squat", "Press and Curl", "Press", "Curl"]);

    drag("Press and Curl", -1.2 * ROW);
    expect(order()).toEqual(["Press and Curl", "Press", "Curl", "Squat"]);
  });
});

describe("dropIndex", () => {
  const mids = [50, 150, 250, 350];
  it("passes the centers it crosses", () => {
    expect(dropIndex(mids, 0, 50 + 120)).toBe(1);
    expect(dropIndex(mids, 0, 50 + 320)).toBe(3);
    expect(dropIndex(mids, 3, 350 - 220)).toBe(1);
    expect(dropIndex(mids, 2, 260)).toBe(2);
  });
});
