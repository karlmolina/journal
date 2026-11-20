import type React from "react";
import { useEffect, useRef, useState } from "react";

// Near the top or bottom of the screen, a dragged item scrolls the page.
const EDGE_PX = 72;
const MAX_SCROLL_PX = 14;

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

// Drag a list's items up and down by a handle to put them in a new order.
// The item follows the finger, the others slide out of its way, and letting
// go calls onDrop(from, to) with positions in the list. Each item takes
// `item(i)` (its ref and style) and its handle takes `handle(i)`.
export default function useDragSort(
  onDrop: (from: number, to: number) => void,
) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const live = useRef<{
    drag: Drag;
    // Where the finger and the item's center were at the start, page px.
    startY: number;
    mids: number[];
    clientY: number;
    pointer: number;
    frame: number;
  } | null>(null);

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

  const end = (drop: boolean) => {
    const l = live.current;
    if (!l) return;
    cancelAnimationFrame(l.frame);
    live.current = null;
    setDrag(null);
    if (drop && l.drag.to !== l.drag.from) onDrop(l.drag.from, l.drag.to);
  };
  useEffect(() => () => end(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (i: number) => ({
    style: { touchAction: "none" } as React.CSSProperties,
    onPointerDown: (e: React.PointerEvent) => {
      if (live.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const rects = items.current.map((el) => el?.getBoundingClientRect());
      const own = rects[i];
      if (!own) return;
      const near = rects[i + 1] ?? rects[i - 1];
      const gap = near
        ? Math.max(
            0,
            near.top > own.top ? near.top - own.bottom : own.top - near.bottom,
          )
        : 0;
      const drag = { from: i, to: i, dy: 0, size: own.height + gap };
      live.current = {
        drag,
        startY: e.clientY + scrollY,
        mids: rects.map((r) => (r ? r.top + scrollY + r.height / 2 : 0)),
        clientY: e.clientY,
        pointer: e.pointerId,
        frame: requestAnimationFrame(tick),
      };
      setDrag(drag);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (live.current?.pointer !== e.pointerId) return;
      live.current.clientY = e.clientY;
      update();
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (live.current?.pointer === e.pointerId) end(true);
    },
    onPointerCancel: () => end(false),
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
      "data-dragging": dragging || undefined,
      style: {
        position: "relative",
        // Lifted above the others, opaque so they don't show through.
        ...(dragging && {
          zIndex: 10,
          borderRadius: "1rem",
          background: "var(--color-base-100)",
          boxShadow: "0 12px 28px -8px rgb(0 0 0 / 0.35)",
        }),
        transform: shift ? `translateY(${shift}px)` : undefined,
        transition: dragging || !drag ? undefined : "transform 150ms ease",
      } as React.CSSProperties,
    };
  };

  return { item, handle, dragging: drag !== null };
}

export type DragSort = ReturnType<typeof useDragSort>;
