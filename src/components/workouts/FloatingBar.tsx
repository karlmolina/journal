import { type RefObject, useEffect, useRef, useState } from "react";

// Along the bottom: the way back to the current exercise in the middle, and
// the workout clock in the corner, which opens pause and finish. The clock
// steps aside while a button sits under it. It keeps its own state, so
// scrolling only re-renders the bar, never the page under it.
export default function FloatingBar({
  currentCard,
  doneBlock,
  elapsed,
  paused,
  onCurrent,
  onClock,
}: {
  currentCard: RefObject<HTMLElement | null>;
  // Just after a set: that set and the button under it.
  doneBlock: HTMLElement | null;
  elapsed: string;
  paused: boolean;
  onCurrent: () => void;
  onClock: () => void;
}) {
  // Which way the current exercise is, while it isn't at the top.
  const [awayFrom, setAwayFrom] = useState<"above" | "below" | null>(null);
  const [clockCovers, setClockCovers] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const check = useRef(() => {});
  check.current = () => {
    // Main buttons near the bottom edge, where the floating buttons sit.
    const zone = innerHeight - 96;
    const nearBottom = (b: Element) => {
      const r = b.getBoundingClientRect();
      return r.bottom > zone && r.top < innerHeight;
    };
    const underBar = [...document.querySelectorAll(".btn-primary")].some(
      (b) => !bar.current?.contains(b) && nearBottom(b),
    );
    const el = doneBlock ?? currentCard.current;
    // The current exercise's main button under the corner clock.
    setClockCovers(
      !!el &&
        [...el.querySelectorAll(".btn-primary")].some(
          (b) =>
            nearBottom(b) && b.getBoundingClientRect().right > innerWidth - 140,
        ),
    );
    // Never over a Start button, wherever it is.
    if (!el || underBar) return setAwayFrom(null);
    const r = el.getBoundingClientRect();
    if (doneBlock) {
      // A set just finished stays where it is, so only once it's off
      // screen, or so nearly that the button would cover it.
      return setAwayFrom(
        r.bottom < 96 ? "above" : r.top > zone ? "below" : null,
      );
    }
    // The exercise's top away from the top of the screen, and the page able
    // to scroll it there.
    const off = r.top - parseFloat(getComputedStyle(el).scrollMarginTop || "0");
    const atBottom = innerHeight + scrollY >= document.body.scrollHeight - 1;
    setAwayFrom(
      off < -2 && scrollY > 0 ? "above" : off > 2 && !atBottom ? "below" : null,
    );
  };
  // Once a frame at most while scrolling, and after every render (the
  // clock ticks each second), since cards grow and shrink without a scroll.
  const frame = useRef(0);
  const schedule = useRef(() => {
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        check.current();
      });
  });
  useEffect(() => schedule.current());
  useEffect(() => {
    const onChange = schedule.current;
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  return (
    <div
      ref={bar}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none"
    >
      <span />
      {awayFrom ? (
        <button
          type="button"
          className="pointer-events-auto btn btn-primary rounded-full font-bold px-6 shadow-lg active:scale-[0.98] transition animate-fade-in"
          onClick={onCurrent}
        >
          {awayFrom === "above" ? "↑" : "↓"} Current exercise
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        className={`justify-self-end h-10 rounded-full px-4 text-base font-bold tabular-nums shadow-lg ring-1 ring-base-content/10 bg-base-100 dark:bg-base-300 cursor-pointer transition-opacity active:scale-95 ${
          clockCovers ? "opacity-0" : "pointer-events-auto"
        } ${paused ? "text-base-content/50 dark:text-base-content/70" : ""}`}
        onClick={onClock}
        aria-label={`Workout time ${elapsed}${paused ? ", paused" : ""}. Open to pause or finish.`}
        aria-hidden={clockCovers || undefined}
        tabIndex={clockCovers ? -1 : undefined}
      >
        {paused && "Paused · "}
        {elapsed}
      </button>
    </div>
  );
}
