import type React from "react";
import { useEffect, useRef, useState } from "react";
import WheelPicker, { DETAIL_ROW_PX, ROW_PX } from "../components/WheelPicker";

// Movement below this is still a tap.
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
// A finger moving slower than this, in px per ms, turns the wheel one row per
// row of movement. Faster than that, each pixel covers more rows, up to
// MAX_GAIN times as many once the finger reaches FAST_PX_MS.
const SLOW_PX_MS = 0.4;
const FAST_PX_MS = 3;
const MAX_GAIN = 6;

// How many rows each pixel of movement is worth at this finger speed.
function gain(pxPerMs: number) {
  const t = (pxPerMs - SLOW_PX_MS) / (FAST_PX_MS - SLOW_PX_MS);
  return 1 + (MAX_GAIN - 1) * Math.min(1, Math.max(0, t));
}

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
// floats over the page: down goes higher, up goes lower, one at a time when
// moving slowly and more per pixel when moving fast. A flick keeps the wheel coasting, and it settles on the nearest value, which
// becomes the field's value. Dragging only works once the field has been
// tapped, so a finger scrolling the page past it doesn't change it; until
// then the page scrolls as usual. Typing still works once it's tapped.
// Spread `bind` on the field's box and render `picker` anywhere.
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
    // Where the finger was last seen.
    y: number;
    start: number;
    // Where the wheel is, in rows.
    position: number;
    moved: boolean;
    // Recent moves, to tell how fast the finger and the wheel are going.
    samples: { t: number; y: number; position: number }[];
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
  // Whether the field has been tapped, so dragging on it turns the wheel. It
  // stays that way after a drag, until a tap or focus lands somewhere else.
  const [armed, setArmed] = useState(false);
  const box = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!armed) return;
    const disarm = (e: PointerEvent) => {
      if (current.current || box.current?.contains(e.target as Node)) return;
      setArmed(false);
    };
    document.addEventListener("pointerdown", disarm, true);
    return () => document.removeEventListener("pointerdown", disarm, true);
  }, [armed]);

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
    const samples = [{ t: e.timeStamp, y: e.clientY, position: 0 }];
    // A touch while the wheel is still up, coasting or just let go of, keeps
    // turning it from where it is.
    const shown = current.current;
    if (shown) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const { start, position } = shown;
      samples[0].position = position;
      drag.current = {
        id: e.pointerId,
        y: e.clientY,
        start,
        position,
        moved: true,
        samples,
      };
      setWheel({ start, position, closing: false });
      return;
    }
    // Not tapped yet: leave the press to scroll the page or focus the field.
    if (!armed) return;
    const parsed = parse(value);
    drag.current = {
      id: e.pointerId,
      y: e.clientY,
      start: parsed === null ? Math.min(max, Math.max(min, 0)) : parsed,
      position: 0,
      moved: false,
      samples,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientY - d.y) < DEAD_ZONE_PX) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      // The field was focused to arm it; the wheel takes over from the
      // keyboard while dragging.
      (document.activeElement as HTMLElement | null)?.blur();
    }
    move(d, e.clientY, e.timeStamp);
    show(d.start, d.position);
  };

  // Turns the wheel by how far the finger went since it was last seen, more
  // rows per pixel the faster it's going (over the last 50ms).
  const move = (d: NonNullable<typeof drag.current>, y: number, t: number) => {
    const recent = d.samples.find((s) => s.t >= t - 50) ?? d.samples.at(-1)!;
    const elapsed = t - recent.t;
    const speed = elapsed > 0 ? Math.abs(y - recent.y) / elapsed : 0;
    d.position = clamp(d.start, d.position + ((y - d.y) / rowPx) * gain(speed));
    d.y = y;
    d.samples.push({ t, y, position: d.position });
    if (d.samples.length > 8) d.samples.shift();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    releasedAt.current = performance.now();
    move(d, e.clientY, e.timeStamp);
    // The wheel's speed over the last tenth of a second, so a fast flick
    // coasts further; a finger that stopped before letting go doesn't flick.
    const recent = d.samples.find((s) => s.t >= e.timeStamp - 100);
    const elapsed = recent ? e.timeStamp - recent.t : 0;
    const speed =
      e.type === "pointerup" && recent && elapsed > 0
        ? (d.position - recent.position) / elapsed
        : 0;
    coast(d.start, d.position, speed);
  };

  const pointer = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };

  const bind = {
    ...pointer,
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      box.current = e.currentTarget;
      setArmed(true);
    },
    // Focus moving to another field disarms; the blur from a drag starting
    // has nowhere to go and keeps it armed.
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && !e.currentTarget.contains(next)) setArmed(false);
    },
    // Until tapped, a finger on the field scrolls the page.
    style: armed
      ? ({ touchAction: "none", cursor: "ns-resize" } as const)
      : undefined,
  };

  const picker = wheel && (
    <WheelPicker
      bind={pointer}
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
