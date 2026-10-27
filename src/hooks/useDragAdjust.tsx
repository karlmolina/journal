import type React from "react";
import { useEffect, useRef, useState } from "react";
import WheelPicker, { DETAIL_ROW_PX, ROW_PX } from "../components/WheelPicker";

// Movement below this is still a tap, which focuses the field for typing.
const DEAD_ZONE_PX = 8;
// How quickly a flicked wheel slows down: the share of speed kept per ms.
const FRICTION = 0.997;
// Below this speed, in rows per ms, the wheel stops coasting and settles.
const MIN_SPEED = 0.002;
// How long the wheel takes to settle onto a row, and to fade away, in ms.
const SETTLE_MS = 180;
const CLOSE_MS = 200;
// After letting go, the wheel stays up at least this long, in ms, so a finger
// that comes back to it keeps turning it instead of starting over.
const REGRAB_MS = 500;

function parseNumber(value: string) {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

// Rounded so 22.5 + 1 doesn't drift into 23.499999.
const formatNumber = (n: number) => String(Math.round(n * 100) / 100);

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

interface DragAdjustOptions {
  value: string;
  onChange: (value: string) => void;
  // Shown at the top of the wheel, like "Reps".
  label: string;
  min?: number;
  max?: number;
  // Fields that aren't plain numbers, like a time, bring their own. A value
  // that doesn't parse starts the wheel at 0.
  parse?: (value: string) => number | null;
  format?: (n: number) => string;
  // A line shown under each value on the wheel, like what a score means.
  detail?: (n: number) => string;
}

// Drag up or down on a number field to turn a scroll wheel of values that
// floats over the page: up goes higher, down goes lower, one at a time. A
// flick keeps the wheel coasting, and it settles on the nearest value, which
// becomes the field's value. A tap without moving focuses the field for
// typing. Spread `bind` on the field's box and render `picker` anywhere.
export default function useDragAdjust({
  value,
  onChange,
  label,
  min = -Infinity,
  max = Infinity,
  parse = parseNumber,
  format = formatNumber,
  detail,
}: DragAdjustOptions) {
  const rowPx = detail ? DETAIL_ROW_PX : ROW_PX;
  const drag = useRef<{
    id: number;
    y: number;
    start: number;
    // Where the wheel was when this touch landed, in rows.
    from: number;
    moved: boolean;
    // Recent moves, to tell how fast the finger was going when it let go.
    samples: { t: number; y: number }[];
  } | null>(null);
  // The value the wheel started from, and how far it has turned, in rows.
  type Wheel = { start: number; position: number; closing: boolean };
  const [wheel, setWheelState] = useState<Wheel | null>(null);
  // The same, for event handlers that run before the next render.
  const current = useRef<Wheel | null>(null);
  const setWheel = (next: Wheel | null) => {
    current.current = next;
    setWheelState(next);
  };
  const frame = useRef(0);
  const closeTimer = useRef(0);
  const releasedAt = useRef(0);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  // Rows count from the start value; the wheel only has rows within min..max.
  const lowest = (start: number) => Math.ceil(min - start);
  const highest = (start: number) => Math.floor(max - start);
  const clamp = (start: number, position: number) =>
    Math.min(highest(start), Math.max(lowest(start), position));

  const show = (start: number, position: number) => {
    const text = format(start + Math.round(position));
    if (text !== value) onChange(text);
    setWheel({ start, position, closing: false });
  };

  // Waits out the rest of the regrab time, then fades the wheel away.
  const close = (start: number, row: number) => {
    show(start, row);
    const wait = releasedAt.current + REGRAB_MS - CLOSE_MS - performance.now();
    closeTimer.current = window.setTimeout(
      () => {
        setWheel({ start, position: row, closing: true });
        closeTimer.current = window.setTimeout(() => setWheel(null), CLOSE_MS);
      },
      Math.max(0, wait),
    );
  };

  // Eases from where the wheel is onto the nearest row, then fades it away.
  const settle = (start: number, from: number) => {
    const row = Math.round(from);
    if (reducedMotion()) return close(start, row);
    const began = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / SETTLE_MS);
      const eased = 1 - (1 - t) ** 3;
      if (t < 1) {
        show(start, from + (row - from) * eased);
        frame.current = requestAnimationFrame(step);
      } else close(start, row);
    };
    frame.current = requestAnimationFrame(step);
  };

  // Lets a flicked wheel keep turning, slowing down until it settles.
  const coast = (start: number, from: number, speed: number) => {
    if (reducedMotion() || Math.abs(speed) < MIN_SPEED)
      return settle(start, from);
    let position = from;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      position += speed * dt;
      speed *= FRICTION ** dt;
      const bounded = clamp(start, position);
      if (bounded !== position || Math.abs(speed) < MIN_SPEED)
        return settle(start, bounded);
      show(start, position);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelAnimationFrame(frame.current);
    clearTimeout(closeTimer.current);
    const samples = [{ t: e.timeStamp, y: e.clientY }];
    // A touch while the wheel is still up, coasting or just let go of, keeps
    // turning it from where it is.
    const shown = current.current;
    if (shown) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const { start, position } = shown;
      drag.current = {
        id: e.pointerId,
        y: e.clientY,
        start,
        from: position,
        moved: true,
        samples,
      };
      setWheel({ start, position, closing: false });
      return;
    }
    const parsed = parse(value);
    drag.current = {
      id: e.pointerId,
      y: e.clientY,
      start: parsed === null ? Math.min(max, Math.max(min, 0)) : parsed,
      from: 0,
      moved: false,
      samples,
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
      // A mouse press already focused the field; the wheel takes over.
      (document.activeElement as HTMLElement | null)?.blur();
    }
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 8) d.samples.shift();
    show(d.start, clamp(d.start, d.from + dy / rowPx));
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    releasedAt.current = performance.now();
    const position = clamp(d.start, d.from + (d.y - e.clientY) / rowPx);
    // Speed over the last tenth of a second; a finger that stopped before
    // letting go doesn't flick.
    const recent = d.samples.find((s) => s.t >= e.timeStamp - 100);
    const elapsed = recent ? e.timeStamp - recent.t : 0;
    const speed =
      e.type === "pointerup" && recent && elapsed > 0
        ? (recent.y - e.clientY) / rowPx / elapsed
        : 0;
    coast(d.start, position, speed);
  };

  const bind = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };

  const picker = wheel && (
    <WheelPicker
      bind={bind}
      label={label}
      position={wheel.position}
      closing={wheel.closing}
      hasRow={(row) =>
        row >= lowest(wheel.start) && row <= highest(wheel.start)
      }
      rowText={(row) => format(wheel.start + row) || "0"}
      rowDetail={detail && ((row) => detail(wheel.start + row))}
    />
  );

  return { bind, picker };
}
