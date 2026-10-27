import type React from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// How far down the sheet has to be dragged to close it.
const CLOSE_PX = 80;

// A drawer that rises from the bottom of the screen over a dimmed page.
// Swipe it down by its title, tap outside it or press Escape to close it.
export default function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    drag.current = { id: e.pointerId, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d?.id === e.pointerId) setDragY(Math.max(0, e.clientY - d.y));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (dragY > CLOSE_PX) onClose();
    else setDragY(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 dark:bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full max-w-lg rounded-t-3xl bg-base-100 dark:bg-base-200 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl ring-1 ring-base-content/10 animate-sheet-up ${dragging ? "" : "transition-transform duration-200"}`}
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div
          className="flex flex-col items-center gap-2 pt-2.5 pb-3 cursor-grab touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-base-content/20" />
          <p className="self-start text-sm font-bold text-base-content/60 dark:text-base-content/80">
            {title}
          </p>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
