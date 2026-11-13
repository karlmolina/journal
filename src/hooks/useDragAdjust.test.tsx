import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import useDragAdjust from "./useDragAdjust";

function Field() {
  const [value, setValue] = useState("10");
  const drag = useDragAdjust({
    value,
    onChange: setValue,
    label: "Reps",
  });
  return (
    <>
      <label data-testid="box" {...drag.bind}>
        <input
          aria-label="Reps"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {drag.picker}
    </>
  );
}

// jsdom's pointer events leave out clientY, so these are mouse events with
// the pointer's fields added.
function pointer(box: HTMLElement, type: string, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
  Object.assign(event, { pointerId: 1, pointerType: "touch" });
  fireEvent(box, event);
}

// Presses on the field and drags the finger down by `px`.
function dragDown(box: HTMLElement, px: number) {
  pointer(box, "pointerdown", 100);
  pointer(box, "pointermove", 100 + px / 2);
  pointer(box, "pointermove", 100 + px);
}

// jsdom drops touch-action, so this looks at the cursor set with it.
const readyToDrag = (box: HTMLElement) =>
  box.getAttribute("style")?.includes("ns-resize") ?? false;

describe("drag to adjust", () => {
  Element.prototype.setPointerCapture ??= vi.fn();

  it("drags a field right away, without a tap first", () => {
    render(<Field />);
    const box = screen.getByTestId("box");
    expect(readyToDrag(box)).toBe(true);
    dragDown(box, 200);
    expect(
      Number(
        (screen.getByRole("textbox", { name: "Reps" }) as HTMLInputElement)
          .value,
      ),
    ).toBeGreaterThan(10);
  });

  it("stays ready to drag after focus moves elsewhere", () => {
    render(
      <>
        <Field />
        <button>Other</button>
      </>,
    );
    const box = screen.getByTestId("box");
    fireEvent.focus(screen.getByRole("textbox", { name: "Reps" }));
    fireEvent.blur(screen.getByRole("textbox", { name: "Reps" }), {
      relatedTarget: screen.getByRole("button", { name: "Other" }),
    });
    expect(readyToDrag(box)).toBe(true);
  });

  it("leaves a still tap to the field, for typing", () => {
    render(<Field />);
    const box = screen.getByTestId("box");
    pointer(box, "pointerdown", 100);
    pointer(box, "pointermove", 103);
    pointer(box, "pointerup", 103);
    expect(screen.getByRole("textbox", { name: "Reps" })).toHaveValue("10");
    expect(screen.queryByText("Reps")).toBeNull();
  });
});
