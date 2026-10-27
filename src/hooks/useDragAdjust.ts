import type React from "react";
import { useRef } from "react";

// How far a finger moves for each step.
const STEP_PX = 16;
// Movement below this is still a tap, which focuses the field for typing.
const DEAD_ZONE_PX = 8;

// Drag up or down on a number field to change it a step at a time: up adds,
// down takes away. Spread the returned handlers on the field's box.
export default function useDragAdjust(
  value: string,
  onChange: (value: string) => void,
  step: number,
  min: number,
) {
  const drag = useRef<{
    id: number;
    y: number;
    start: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const n = Number(value);
    drag.current = {
      id: e.pointerId,
      y: e.clientY,
      start: value.trim() !== "" && Number.isFinite(n) ? n : 0,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = d.y - e.clientY;
    if (!d.moved) {
      if (Math.abs(dy) < DEAD_ZONE_PX) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const next = Math.max(min, d.start + Math.trunc(dy / STEP_PX) * step);
    // Rounded so 2.5 steps don't drift into 22.499999.
    const text = String(Math.round(next * 100) / 100);
    if (text !== value) onChange(text);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
}
