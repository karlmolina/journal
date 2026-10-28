// Opened from the workout clock: the time so far, pause or resume, and
// finishing with a note on how it went.
export default function WorkoutClockDialog({
  paused,
  started,
  elapsed,
  notes,
  onNotesChange,
  onPause,
  onResume,
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
  onClose: () => void;
  onFinish: () => void;
}) {
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
        <p
          className={`text-3xl font-extrabold tracking-tight tabular-nums ${
            paused ? "opacity-50" : ""
          }`}
          role="timer"
          aria-live="off"
        >
          {elapsed}
        </p>
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
