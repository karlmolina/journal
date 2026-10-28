import type { Side } from "../hooks/useWorkouts";

// What the timer is doing. Times are epoch milliseconds so the clocks stay
// right across reloads and while the phone is locked.
// `side` is set for exercises done one side at a time. `supersetNext` is
// the exercise that follows straight on in a superset.
// Rest counts up from when a set is stopped (`Rest.since`) until the next
// one starts, and that time is saved with the next set. `target` is the
// planned rest; the phone buzzes when it's reached.
export interface Rest {
  since: number;
  target: number;
  alerted?: boolean;
}

export type Phase =
  | {
      phase: "ready";
      // Still resting, after choosing to change the next exercise.
      rest?: Rest;
      // Picking another exercise, so the name is a field, not the title.
      editing?: boolean;
      switchTo?: Side;
      supersetNext?: string;
      // The set just stopped, to fix its numbers until the next one starts.
      logged?: boolean;
    }
  | {
      phase: "running";
      exercise: string;
      startedAt: number;
      // Set when the start was pushed back for a countdown (straight on
      // from the set before), so a plain Start never shows one.
      countdown?: boolean;
      side?: Side | null;
      // The rest before this set, and the rest itself to carry on with if
      // the set is thrown away.
      restSeconds?: number | null;
      rest?: Rest;
      // The reps and weight it's saved with, the plan's until changed.
      reps?: string;
      weight?: string;
    }
  | {
      phase: "logging";
      exercise: string;
      seconds: number | null;
      side?: Side | null;
      restSeconds?: number | null;
      // When the set was stopped, and the rest that started then (rest runs
      // while the set is filled in).
      stoppedAt?: number;
      rest?: Rest;
    }
  | { phase: "resting"; rest: Rest; logged?: boolean }
  // A set just finished: fix its numbers, then go on to `then`, the rest or
  // the next set.
  | { phase: "done"; exercise: string; side?: Side | null; then: Phase };

interface Saved {
  workoutId: string;
  state: Phase;
}

export function readSaved(key: string, workoutId: string): Phase {
  try {
    const saved: Saved = JSON.parse(localStorage.getItem(key) ?? "null");
    // Older saves counted rest down and have no `rest`.
    if (
      saved?.workoutId === workoutId &&
      (saved.state.phase !== "resting" || saved.state.rest)
    )
      return saved.state;
  } catch {
    // Start fresh.
  }
  return { phase: "ready" };
}

export function writeSaved(key: string, workoutId: string, state: Phase) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ workoutId, state } satisfies Saved),
    );
  } catch {
    // The timer still works; it just won't survive a reload.
  }
}
