import { useEffect, useState } from "react";
import type { SetInput, Side } from "../../hooks/useWorkouts";
import type { Exercise } from "../../hooks/useExercises";
import { onGrid } from "../../hooks/useClock";
import { formatClock } from "../../functions/formatDuration";
import { sideLabel } from "../../functions/planProgress";
import SetForm from "./SetForm";
import ExerciseInput from "./ExerciseInput";
import ExerciseHowTo from "./ExerciseHowTo";
import ExerciseNote, { type ExerciseNotesProps } from "./ExerciseNote";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45 dark:placeholder:text-base-content/65";

// What the timer is doing. Times are epoch milliseconds so the clocks stay
// right across reloads and while the phone is locked.
// `side` is set for exercises done one side at a time. `supersetNext` is
// the exercise that follows straight on in a superset.
// Rest counts up from when a set is stopped (`Rest.since`) until the next
// one starts, and that time is saved with the next set. `target` is the
// planned rest; the phone buzzes when it's reached.
interface Rest {
  since: number;
  target: number;
  alerted?: boolean;
}

type Phase =
  | {
      phase: "ready";
      // Still resting, after choosing to change the next exercise.
      rest?: Rest;
      switchTo?: Side;
      supersetNext?: string;
    }
  | {
      phase: "running";
      exercise: string;
      startedAt: number;
      side?: Side | null;
      // The rest before this set, and the rest itself to go back to on cancel.
      restSeconds?: number | null;
      rest?: Rest;
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
  | { phase: "resting"; rest: Rest };

interface Saved {
  workoutId: string;
  state: Phase;
}

function readSaved(key: string, workoutId: string): Phase {
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

// A buzz when the planned rest is up (no sound); the screen shows it too.
function restTargetAlert() {
  navigator.vibrate?.([200, 100, 200]);
}

interface SetTimerProps {
  workoutId: string;
  storageKey: string;
  // The workout's clock: the current time, and when the workout started.
  // Set and rest times count from the workout clock's ticks so all the
  // clocks change seconds together.
  now: number;
  clockOrigin: number;
  // The exercise to do next, from the plan or the library.
  exercise: string;
  // A line about the target, like "Set 2 of 3 · 8-10 reps".
  target?: string;
  notes?: string;
  suggestions: string[];
  prefillFor: (exercise: string) => Partial<SetInput>;
  // Rest after a set, and the exercise to do next when it's in a superset.
  afterSet: (set: SetInput) => { rest: number; next?: string };
  // The side to do next for one-side-at-a-time exercises, otherwise null.
  sideFor: (exercise: string) => Side | null;
  // The other exercises in this one's superset, if it's in one.
  supersetWith: (exercise: string) => string[] | undefined;
  onSuperset: (exercise: string, partner: string) => void;
  onLeaveSuperset: (exercise: string) => void;
  // The library entry for an exercise, to show how it's done.
  lookup?: (exercise: string) => Exercise | undefined;
  // Your own notes on exercises.
  exerciseNotes?: ExerciseNotesProps;
  onSave: (set: SetInput) => void;
}

// The next exercise and its target as one big tap target that starts the set.
function StartExerciseButton({
  exercise,
  target,
  notes,
  label,
  onStart,
}: {
  exercise: string;
  target?: string;
  notes?: string;
  label: string;
  onStart: () => void;
}) {
  if (!exercise.trim())
    return (
      <button
        type="button"
        className="btn btn-primary btn-lg rounded-full font-bold w-full"
        disabled
      >
        {label}
      </button>
    );
  return (
    <button
      type="button"
      className="w-full rounded-3xl bg-primary text-primary-content px-5 py-6 flex flex-col items-center gap-1 text-center shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
      onClick={onStart}
    >
      <span className="text-2xl font-extrabold leading-tight">{exercise}</span>
      {target && (
        <span className="text-base font-bold opacity-90">{target}</span>
      )}
      {notes && (
        <span className="text-sm font-semibold opacity-80">{notes}</span>
      )}
      <span className="mt-3 self-stretch flex items-center justify-center gap-2 rounded-full bg-primary-content/15 py-3 text-lg font-bold">
        <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
        </svg>
        {label}
      </span>
    </button>
  );
}

// Shows what the current exercise is in a superset with, and adds more
// exercises to it (any number: a superset of three or more is a circuit).
function SupersetControl({
  exercise,
  partners,
  suggestions,
  onSuperset,
  onLeave,
}: {
  exercise: string;
  partners?: string[];
  suggestions: string[];
  onSuperset: (partner: string) => void;
  onLeave: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [partner, setPartner] = useState("");
  const linkClass =
    "btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";

  if (!adding)
    return partners?.length ? (
      <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm font-semibold text-base-content/60 dark:text-base-content/80">
        <span className="text-center">Superset with {partners.join(", ")}</span>
        <button
          type="button"
          className={linkClass}
          onClick={() => setAdding(true)}
        >
          + Add
        </button>
        <button type="button" className={linkClass} onClick={onLeave}>
          Remove
        </button>
      </div>
    ) : (
      <button
        type="button"
        className={`${linkClass} self-center`}
        onClick={() => setAdding(true)}
        disabled={!exercise}
      >
        + Superset with another exercise
      </button>
    );

  const add = () => {
    const name = partner.trim();
    if (!name || name.toLowerCase() === exercise.toLowerCase()) return;
    onSuperset(name);
    // Stay open so a circuit can be built one exercise after another.
    setPartner("");
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-base-content/5 p-2">
      <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 px-1">
        {partners?.length
          ? `Superset with ${partners.join(", ")}. Add as many as you like.`
          : "Do a set of each in turn, then rest."}
      </p>
      <ExerciseInput
        className={fieldClass}
        value={partner}
        onChange={setPartner}
        suggestions={suggestions.filter(
          (n) =>
            ![exercise, ...(partners ?? [])].some(
              (m) => m.toLowerCase() === n.toLowerCase(),
            ),
        )}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-bold flex-1"
          onClick={() => setAdding(false)}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm rounded-full font-bold flex-1"
          onClick={add}
          disabled={!partner.trim()}
        >
          Add to superset
        </button>
      </div>
    </div>
  );
}

export default function SetTimer({
  workoutId,
  storageKey,
  now,
  clockOrigin,
  exercise,
  target,
  notes,
  suggestions,
  prefillFor,
  afterSet,
  sideFor,
  supersetWith,
  onSuperset,
  onLeaveSuperset,
  lookup,
  exerciseNotes,
  onSave,
}: SetTimerProps) {
  const [state, setState] = useState<Phase>(() =>
    readSaved(storageKey, workoutId),
  );
  const [name, setName] = useState(exercise);
  // Follow the plan when it moves on to the next exercise.
  const [prevExercise, setPrevExercise] = useState(exercise);
  if (exercise !== prevExercise) {
    setPrevExercise(exercise);
    if (exercise) setName(exercise);
  }

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ workoutId, state } satisfies Saved),
      );
    } catch {
      // The timer still works; it just won't survive a reload.
    }
  }, [storageKey, workoutId, state]);

  const rest = state.phase === "running" ? undefined : state.rest;
  // Whole seconds from `from` to `to`, on the workout clock's ticks.
  const since = (from: number, to = now) =>
    Math.max(0, Math.floor((to - onGrid(from, clockOrigin)) / 1000));
  const rested = rest ? since(rest.since) : 0;

  // Buzz once when the planned rest is up; the clock keeps counting.
  const restDue = !!rest && !rest.alerted && rested >= rest.target;
  useEffect(() => {
    if (!restDue) return;
    restTargetAlert();
    setState((s) =>
      s.phase !== "running" && s.rest
        ? { ...s, rest: { ...s.rest, alerted: true } }
        : s,
    );
  }, [restDue]);

  const side = sideFor(name);

  // How long the rest has run, to save with the set that ends it.
  const restUntil = (at: number) => (rest ? since(rest.since, at) : null);

  const startSet = () => {
    if (!name.trim()) return;
    const at = Date.now();
    setState({
      phase: "running",
      exercise: name.trim(),
      startedAt: at,
      side,
      restSeconds: restUntil(at),
      rest,
    });
  };

  // After the left side, go straight to the right; rest after the right.
  // In a superset, go straight to the next exercise and rest after the round.
  const restAfter = (set: SetInput) =>
    set.side === "left" ? { rest: 0 } : afterSet(set);

  const stopSet = () => {
    if (state.phase !== "running") return;
    const at = Date.now();
    const { rest: target } = restAfter({
      exercise_name: state.exercise,
      reps: null,
      weight: null,
      duration_seconds: null,
      side: state.side ?? null,
    });
    setState({
      phase: "logging",
      exercise: state.exercise,
      seconds: since(state.startedAt, at) || null,
      side: state.side,
      restSeconds: state.restSeconds,
      stoppedAt: at,
      rest: target > 0 ? { since: at, target } : undefined,
    });
  };

  // Starts the right side straight after the left: one tap saves the left
  // side with the timer's time and the usual numbers (fix them later in the
  // set list), and starts the right side's timer.
  const startRightSide = () => {
    if (state.phase !== "running" || state.side !== "left") return;
    const at = Date.now();
    const { reps = null, weight = null } = prefillFor(state.exercise);
    onSave({
      exercise_name: state.exercise,
      reps,
      weight,
      duration_seconds: since(state.startedAt, at) || null,
      side: "left",
      rest_seconds: state.restSeconds ?? null,
    });
    setState({
      phase: "running",
      exercise: state.exercise,
      startedAt: at,
      side: "right",
      restSeconds: null,
    });
  };

  // The exercise a set leads straight into, with no rest, in a superset.
  const supersetNext = (set: SetInput) => {
    if (set.side === "left") return undefined;
    const { rest: target, next } = afterSet(set);
    return target === 0 &&
      next &&
      next.toLowerCase() !== set.exercise_name.toLowerCase()
      ? next
      : undefined;
  };

  const save = (input: SetInput) => {
    if (state.phase !== "logging") return;
    const set = { ...input, rest_seconds: state.restSeconds ?? null };
    onSave(set);
    // After a timed left side the right side's timer starts straight away,
    // like the next exercise in a superset.
    if (set.side === "left") {
      if (!state.stoppedAt) {
        setState({ phase: "ready", switchTo: "right" });
        return;
      }
      setState({
        phase: "running",
        exercise: set.exercise_name,
        startedAt: Date.now(),
        side: "right",
        restSeconds: null,
      });
      return;
    }
    const { rest: target, next } = afterSet(set);
    if (next) setName(next);
    // In a superset with no rest before the next exercise, its set starts
    // right away.
    const straightOn = supersetNext(set);
    if (straightOn) {
      setState({
        phase: "running",
        exercise: straightOn,
        startedAt: Date.now(),
        side: sideFor(straightOn),
        restSeconds: null,
      });
      return;
    }
    setState(
      target > 0
        ? {
            phase: "resting",
            // Rest started when the set was stopped, or now for a set
            // logged without the timer.
            rest:
              state.rest?.target === target
                ? state.rest
                : { since: state.stoppedAt ?? Date.now(), target },
          }
        : {
            phase: "ready",
            supersetNext:
              next && next.toLowerCase() !== set.exercise_name.toLowerCase()
                ? next
                : undefined,
          },
    );
  };

  const restClock = rest && (
    <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
      Resting {formatClock(rested)}
      {rest.target > 0 && ` · target ${formatClock(rest.target)}`}
    </p>
  );

  const startLabel = side ? `Start ${side} side` : "Start set";

  if (state.phase === "running")
    return (
      <div className="flex flex-col items-center text-center">
        <p className="font-bold">{state.exercise}</p>
        {state.side && (
          <p className="text-sm font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]">
            {sideLabel(state.side)}
          </p>
        )}
        {target && (
          <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80">
            {target}
          </p>
        )}
        <div className="w-full mt-2 flex flex-col gap-2 text-left">
          <ExerciseHowTo exercise={lookup?.(state.exercise)} />
          {exerciseNotes && (
            <ExerciseNote
              key={state.exercise}
              exercise={state.exercise}
              regions={lookup?.(state.exercise)?.body_regions ?? []}
              {...exerciseNotes}
            />
          )}
        </div>
        <p
          className="my-2 text-5xl font-extrabold tracking-tight tabular-nums"
          role="timer"
        >
          {formatClock(since(state.startedAt))}
        </p>
        {state.side === "left" ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
              onClick={startRightSide}
            >
              Start right side
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 mt-1"
              onClick={stopSet}
            >
              Stop and fill in the left side
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
            onClick={stopSet}
          >
            Stop set
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 mt-1"
          onClick={() => setState({ phase: "ready", rest: state.rest })}
        >
          Cancel set
        </button>
      </div>
    );

  if (state.phase === "logging") {
    const straightOn = supersetNext({
      exercise_name: state.exercise,
      reps: null,
      weight: null,
      duration_seconds: null,
      side: state.side ?? null,
    });
    return (
      <div className="flex flex-col gap-2">
        {restClock}
        <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80">
          {state.side && `${sideLabel(state.side)}. `}
          {state.seconds
            ? `That set took ${formatClock(state.seconds)}. Check the numbers and save it.`
            : "Fill in the set and save it."}
          {state.side === "left" && state.stoppedAt
            ? " Saving starts the right side right away."
            : straightOn && ` Saving starts ${straightOn} right away.`}
        </p>
        <SetForm
          suggestions={suggestions}
          initial={{
            ...prefillFor(state.exercise),
            exercise_name: state.exercise,
            duration_seconds: state.seconds,
            side: state.side ?? null,
          }}
          submitLabel={
            state.side === "left" && state.stoppedAt
              ? "Save and start right side"
              : straightOn
                ? "Save and start next"
                : "Save set"
          }
          onCancel={() => setState({ phase: "ready", rest: state.rest })}
          onAdd={save}
        />
      </div>
    );
  }

  if (state.phase === "resting") {
    const goal = state.rest.target;
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
          Rest
        </p>
        <p
          className={`my-1 text-5xl font-extrabold tracking-tight tabular-nums ${rested >= goal ? "text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]" : ""}`}
          role="timer"
        >
          {formatClock(rested)}
        </p>
        <div className="w-full h-1.5 rounded-full bg-base-content/10 overflow-hidden mb-1">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${Math.min(1, rested / goal) * 100}%` }}
          />
        </div>
        <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 mb-2 tabular-nums">
          {rested >= goal
            ? `Target ${formatClock(goal)} reached. Go when you're ready.`
            : `Target ${formatClock(goal)}`}
        </p>
        <StartExerciseButton
          exercise={name}
          target={target}
          label={side ? startLabel : "Start next set"}
          onStart={startSet}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 mt-1"
          onClick={() => setState({ phase: "ready", rest: state.rest })}
        >
          Change exercise
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {state.rest && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold text-center tabular-nums">
          Resting {formatClock(rested)} · target{" "}
          {formatClock(state.rest.target)}
        </p>
      )}
      {state.switchTo && side === state.switchTo && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold text-center">
          Now the {state.switchTo} side.
        </p>
      )}
      {state.supersetNext && name === state.supersetNext && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold text-center">
          Superset: straight on to {state.supersetNext}, no rest.
        </p>
      )}
      <ExerciseInput
        className={fieldClass}
        value={name}
        onChange={setName}
        suggestions={suggestions}
      />
      <StartExerciseButton
        exercise={name}
        target={target}
        notes={notes}
        label={startLabel}
        onStart={startSet}
      />
      <ExerciseHowTo exercise={lookup?.(name)} />
      {exerciseNotes && name.trim() && (
        <ExerciseNote
          // Prefixed: the superset control below is keyed by the name too.
          key={`note:${name.trim().toLowerCase()}`}
          exercise={name}
          regions={lookup?.(name)?.body_regions ?? []}
          {...exerciseNotes}
        />
      )}
      <SupersetControl
        key={name.trim().toLowerCase()}
        exercise={name.trim()}
        partners={name.trim() ? supersetWith(name) : undefined}
        suggestions={suggestions}
        onSuperset={(partner) => onSuperset(name.trim(), partner)}
        onLeave={() => onLeaveSuperset(name.trim())}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 self-center"
        onClick={() =>
          setState({
            phase: "logging",
            exercise: name.trim(),
            seconds: null,
            side,
            restSeconds: restUntil(Date.now()),
          })
        }
      >
        Log a set without the timer
      </button>
    </div>
  );
}
