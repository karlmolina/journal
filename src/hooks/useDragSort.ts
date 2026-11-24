import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Near the top or bottom of the screen, a dragged item scrolls the page.
const EDGE_PX = 72;
const MAX_SCROLL_PX = 14;
// How long to hold an item still before it lifts, and how far the finger
// may wander meanwhile before it counts as a scroll instead.
export const HOLD_MS = 400;
const HOLD_SLOP_PX = 10;

type Drag = {
  from: number;
  to: number;
  // How far the item has moved from where it was picked up, in px.
  dy: number;
  // The room it takes up, gap included, so the others make way for it.
  size: number;
};

// Where `to` lands for an item centered at `center`, among items whose
// centers are `mids`: past every center it has crossed.
export function dropIndex(mids: number[], from: number, center: number) {
  let to = from;
  while (to + 1 < mids.length && center > mids[to + 1]) to++;
  while (to - 1 >= 0 && center < mids[to - 1]) to--;
  return to;
}

// Held on these, a press is for them: typing, or dragging a number.
const NOT_HELD =
  "input, textarea, select, [contenteditable], [role=dialog], [style*='touch-action']";

// A press inside a nested list lifts the innermost item only.
const claimed = new WeakSet<Event>();

// Drag a list's items up and down to put them in a new order. The item
// follows the finger, the others slide out of its way, and letting go calls
// onDrop(from, to) with positions in the list. Each item takes `item(i)`
// (its ref and style) and its handle takes `handle(i)`.
//
// With `onLift`, an item is also picked up by holding it anywhere: onLift
// (true) runs first so the list can shrink, the item is then put back under
// the finger, and onLift(false) runs once it's let go.
export default function useDragSort(
  onDrop: (from: number, to: number) => void,
  onLift?: (lifted: boolean) => void,
) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const live = useRef<{
    drag: Drag;
    // Where the item's center would be with the finger where it started,
    // page px: the item's own center, or the finger for a lifted one.
    startY: number;
    mids: number[];
    clientY: number;
    pointer: number;
    frame: number;
  } | null>(null);
  // A hold waiting to lift, or lifted and waiting for the list to shrink.
  const hold = useRef<{
    i: number;
    pointer: number;
    x: number;
    y: number;
    timer: number;
    lifted: boolean;
  } | null>(null);
  const [lifting, setLifting] = useState(0);
  // A lifted item just let go, kept where it was on screen as the list
  // grows back.
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  const onLiftRef = useRef(onLift);
  onLiftRef.current = onLift;

  const update = () => {
    const l = live.current;
    if (!l) return;
    const dy = l.clientY + scrollY - l.startY;
    const to = dropIndex(l.mids, l.drag.from, l.mids[l.drag.from] + dy);
    l.drag = { ...l.drag, dy, to };
    setDrag(l.drag);
  };

  // Scrolls while the finger rests near an edge, so far items can be reached.
  const tick = () => {
    const l = live.current;
    if (!l) return;
    const top = l.clientY - EDGE_PX;
    const bottom = l.clientY - (innerHeight - EDGE_PX);
    const by =
      top < 0
        ? Math.max(-MAX_SCROLL_PX, top / 4)
        : bottom > 0
          ? Math.min(MAX_SCROLL_PX, bottom / 4)
          : 0;
    if (by) {
      scrollBy({ top: by, behavior: "instant" });
      update();
    }
    l.frame = requestAnimationFrame(tick);
  };

  // Measures the list and starts following the finger.
  const start = (
    i: number,
    clientY: number,
    pointer: number,
    lift: boolean,
  ) => {
    let rects = items.current.map((el) => el?.getBoundingClientRect());
    let own = rects[i];
    if (!own) return false;
    if (lift) {
      // The list has just shrunk: bring the item back under the finger.
      const by = own.top + own.height / 2 - clientY;
      if (Math.abs(by) >= 1) {
        scrollBy({ top: by, behavior: "instant" });
        rects = items.current.map((el) => el?.getBoundingClientRect());
        own = rects[i]!;
      }
    }
    const near = rects[i + 1] ?? rects[i - 1];
    const gap = near
      ? Math.max(
          0,
          near.top > own.top ? near.top - own.bottom : own.top - near.bottom,
        )
      : 0;
    const mids = rects.map((r) => (r ? r.top + scrollY + r.height / 2 : 0));
    const drag = { from: i, to: i, dy: 0, size: own.height + gap };
    live.current = {
      drag,
      startY: lift ? mids[i] : clientY + scrollY,
      mids,
      clientY,
      pointer,
      frame: requestAnimationFrame(tick),
    };
    if (lift) update();
    else setDrag(drag);
    return true;
  };

  const cancelHold = () => {
    const h = hold.current;
    if (!h) return;
    clearTimeout(h.timer);
    hold.current = null;
    if (h.lifted) onLiftRef.current?.(false);
  };

  const end = (drop: boolean) => {
    const l = live.current;
    const lifted = hold.current?.lifted;
    cancelHold();
    if (!l) return;
    cancelAnimationFrame(l.frame);
    live.current = null;
    if (lifted) {
      const el = items.current[l.drag.from];
      if (el) anchor.current = { el, top: el.getBoundingClientRect().top };
      // The press's click isn't a tap on whatever it ends over.
      const swallow = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      addEventListener("click", swallow, true);
      setTimeout(() => removeEventListener("click", swallow, true), 400);
    }
    setDrag(null);
    if (drop && l.drag.to !== l.drag.from) onDrop(l.drag.from, l.drag.to);
  };

  // Follows the pointer wherever it goes, even off the item it started on.
  // The listeners stay the same from render to render, so they come off.
  const latest = useRef({ onMove, onUp, onCancel });
  const [listeners] = useState(() => ({
    pointermove: (e: PointerEvent) => latest.current.onMove(e),
    pointerup: (e: PointerEvent) => latest.current.onUp(e),
    pointercancel: () => latest.current.onCancel(),
  }));
  const listen = (on: boolean) => {
    for (const [type, fn] of Object.entries(listeners))
      if (on) addEventListener(type, fn as EventListener);
      else removeEventListener(type, fn as EventListener);
  };
  function onMove(e: PointerEvent) {
    const h = hold.current;
    if (h && !h.lifted && h.pointer === e.pointerId) {
      if (Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP_PX) {
        cancelHold();
        listen(false);
      }
      return;
    }
    if (live.current?.pointer !== e.pointerId) return;
    live.current.clientY = e.clientY;
    update();
  }
  function onUp(e: PointerEvent) {
    if (hold.current?.pointer === e.pointerId && !live.current) {
      cancelHold();
      listen(false);
      return;
    }
    if (live.current?.pointer !== e.pointerId) return;
    listen(false);
    end(true);
  }
  function onCancel() {
    listen(false);
    end(false);
  }
  latest.current = { onMove, onUp, onCancel };

  // Once held items can lift, the page mustn't scroll under a lifted one.
  const holdable = !!onLift;
  useEffect(() => {
    if (!holdable) return;
    const still = (e: TouchEvent) => {
      if (hold.current?.lifted && e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", still, { passive: false });
    return () => document.removeEventListener("touchmove", still);
  }, [holdable]);

  // Lifted: the list has shrunk by now, so measure it and follow.
  useLayoutEffect(() => {
    const h = hold.current;
    if (!lifting || !h?.lifted || live.current) return;
    if (!start(h.i, h.y, h.pointer, true)) {
      listen(false);
      cancelHold();
    }
  }, [lifting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grown back: the item let go stays where it was dropped.
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a || drag) return;
    anchor.current = null;
    const by = a.el.getBoundingClientRect().top - a.top;
    if (a.el.isConnected && Math.abs(by) >= 1)
      scrollBy({ top: by, behavior: "instant" });
  });

  useEffect(
    () => () => {
      listen(false);
      end(false);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handle = (i: number) => ({
    style: { touchAction: "none" } as React.CSSProperties,
    onPointerDown: (e: React.PointerEvent) => {
      if (live.current || hold.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      claimed.add(e.nativeEvent);
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      if (start(i, e.clientY, e.pointerId, false)) listen(true);
    },
  });

  // Held still for a moment anywhere on the item (but a field), it lifts.
  const press = (i: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (claimed.has(e.nativeEvent)) return;
      if (live.current || hold.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as Element).closest?.(NOT_HELD)) return;
      claimed.add(e.nativeEvent);
      const pointer = e.pointerId;
      hold.current = {
        i,
        pointer,
        x: e.clientX,
        y: e.clientY,
        lifted: false,
        timer: window.setTimeout(() => {
          const h = hold.current;
          if (!h || h.pointer !== pointer) return;
          h.lifted = true;
          getSelection()?.removeAllRanges();
          navigator.vibrate?.(15);
          onLiftRef.current?.(true);
          setLifting((n) => n + 1);
        }, HOLD_MS),
      };
      listen(true);
    },
    // A long press mustn't open the phone's menu over a lifted item.
    onContextMenu: (e: React.MouseEvent) => {
      if (hold.current) e.preventDefault();
    },
  });

  const item = (i: number) => {
    let shift = 0;
    if (drag) {
      if (i === drag.from) shift = drag.dy;
      else if (i > drag.from && i <= drag.to) shift = -drag.size;
      else if (i < drag.from && i >= drag.to) shift = drag.size;
    }
    const dragging = drag?.from === i;
    return {
      ref: (el: HTMLElement | null) => {
        items.current[i] = el;
      },
      ...(onLift && press(i)),
      "data-dragging": dragging || undefined,
      style: drag
        ? ({
            position: "relative",
            // Lifted above the others, opaque so they don't show through.
            ...(dragging && {
              zIndex: 10,
              borderRadius: "1rem",
              background: "var(--color-base-100)",
              boxShadow: "0 12px 28px -8px rgb(0 0 0 / 0.35)",
            }),
            transform: shift ? `translateY(${shift}px)` : undefined,
            transition: dragging ? undefined : "transform 150ms ease",
          } as React.CSSProperties)
        : undefined,
    };
  };

  return { item, handle, dragging: drag !== null };
}

export type DragSort = ReturnType<typeof useDragSort>;
