import { useEffect, useState } from "react";
import { formatClock, parseClock } from "../../functions/formatDuration";
import useDragAdjust from "../../hooks/useDragAdjust";

// Opened from the workout clock: the time so far, pause or resume, and
// finishing with a note on how it went. The time itself can be changed:
// typed, or dragged on a wheel a minute at a time.
export default function WorkoutClockDialog({
  paused,
  started,
  elapsed,
  notes,
  onNotesChange,
  onPause,
  onResume,
  onElapsedChange,
  onClose,
  onFinish,
}: {
  paused: boolean;
  // When the workout started, as a time of day.
  started: string;
  elapsed: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onPause: () => void;
  onResume: () => void;
  onElapsedChange: (seconds: number) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  // The time being changed; the live clock shows again once it's saved.
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useDragAdjust({
    value: draft ?? elapsed,
    onChange: setDraft,
    label: "Workout time",
    min: 0,
    parse: (t) => {
      const s = parseClock(t);
      return s === null ? null : Math.floor(s / 60);
    },
    format: (m) => formatClock(m * 60),
  });
  const seconds = draft === null ? null : parseClock(draft);
  const invalid = draft !== null && draft.trim() !== "" && seconds === null;
  useEffect(() => {
    if (seconds === null) return;
    const id = setTimeout(() => {
      onElapsedChange(seconds);
      setDraft(null);
    }, 800);
    return () => clearTimeout(id);
  }, [seconds, onElapsedChange]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/70 animate-fade-in p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Workout"
        className="w-full max-w-md rounded-2xl bg-base-100 dark:bg-base-200 p-4 flex flex-col items-center text-center gap-2 shadow-xl ring-1 ring-base-content/10 animate-pop-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
          {paused ? "Paused" : "In progress"} · started {started}
        </p>
        <label
          className={`rounded-2xl bg-base-content/6 px-4 py-1 transition focus-within:bg-base-content/12 ${
            invalid ? "ring-2 ring-error" : ""
          }`}
          {...drag.bind}
        >
          <input
            className={`w-44 bg-transparent text-center text-3xl font-extrabold tracking-tight tabular-nums outline-none ${
              paused && draft === null ? "opacity-50" : ""
            }`}
            inputMode="numeric"
            value={draft ?? elapsed}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => invalid && setDraft(null)}
            aria-label="Workout time, as minutes:seconds or hours:minutes:seconds"
          />
        </label>
        {drag.picker}
        <button
          type="button"
          className="btn btn-sm rounded-full font-bold bg-base-content/8 border-0 shadow-none"
          onClick={paused ? onResume : onPause}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <textarea
          className="w-full resize-none rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65 text-left"
          rows={2}
          placeholder="How did it go? (optional)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
        <div className="flex gap-2 w-full">
          <button
            type="button"
            className="btn btn-ghost rounded-full font-bold flex-1"
            onClick={onClose}
            autoFocus
          >
            Keep going
          </button>
          <button
            type="button"
            className="btn btn-primary rounded-full font-bold flex-1"
            onClick={onFinish}
          >
            Finish workout
          </button>
        </div>
      </section>
    </div>
  );
}
