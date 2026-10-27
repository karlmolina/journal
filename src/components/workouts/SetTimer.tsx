import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SetInput, Side } from "../../hooks/useWorkouts";
import type { Exercise } from "../../hooks/useExercises";
import { onGrid } from "../../hooks/useClock";
import { formatClock } from "../../functions/formatDuration";
import {
  FIRST_SIDE,
  SECOND_SIDE,
  sideLabel,
} from "../../functions/planProgress";
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
      side?: Side | null;
      // The rest before this set, and the rest itself to carry on with if
      // the set is thrown away.
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
  | { phase: "resting"; rest: Rest; logged?: boolean };

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

function writeSaved(key: string, workoutId: string, state: Phase) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ workoutId, state } satisfies Saved),
    );
  } catch {
    // The timer still works; it just won't survive a reload.
  }
}

// Seconds to get set before the right side, or the next exercise in a
// superset, starts timing.
const COUNTDOWN = 3;

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
  // The plan's tip for the exercise, and what it's working toward.
  notes?: string;
  goal?: string;
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
  // Whether the set just stopped can still be fixed: until the next starts.
  onLoggedChange?: (logged: boolean) => void;
  // Goes between the exercise's title and its clock or start button: its
  // sets so far.
  aboveClock?: React.ReactNode;
  // What there is to show in the rest card: a rest, and the set just
  // stopped.
  onSlotChange?: (content: SlotContent) => void;
  // What the timer is doing: ready, running, logging or resting.
  onPhaseChange?: (phase: TimerPhase) => void;
  // A card of its own for the rest (null until it's on the page); without
  // one the rest shows in place.
  restSlot?: HTMLElement | null;
  // In a plan, Swap exercise on the card picks another exercise instead.
  hideChange?: boolean;
}

export type TimerPhase = Phase["phase"];
export type SlotContent = "none" | "rest";

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

// What the plan says: the set and target, then its tip and the goal, each
// on a line of its own.
function PlanLines({
  target,
  notes,
  goal,
}: {
  target?: string;
  notes?: string;
  goal?: string;
}) {
  if (!target && !notes && !goal) return null;
  return (
    <div className="flex flex-col gap-0.5 text-sm text-base-content/60 dark:text-base-content/80">
      {target && <p className="font-semibold tabular-nums">{target}</p>}
      {notes && <p className="font-medium">{notes}</p>}
      {goal && <p className="font-medium">Goal: {goal}</p>}
    </div>
  );
}

// The exercise you're on, its plan and how it's done. The set timer shows it
// the same while a set runs, while it's filled in and before the next one,
// so the card doesn't jump around on Stop set; during a rest it heads the
// next exercise's card.
export function ExerciseHeader({
  name,
  side,
  target,
  notes,
  goal,
  lookup,
  exerciseNotes,
}: {
  name: string;
  side?: Side | null;
  target?: string;
  notes?: string;
  goal?: string;
  lookup?: (exercise: string) => Exercise | undefined;
  exerciseNotes?: ExerciseNotesProps;
}) {
  return (
    <div className="w-full flex flex-col">
      {/* The biggest text on the screen: what you're doing now. */}
      <p className="text-4xl font-extrabold leading-tight tracking-tight">
        {name}
      </p>
      {side && (
        <p className="text-sm font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]">
          {sideLabel(side)}
        </p>
      )}
      <PlanLines target={target} notes={notes} goal={goal} />
      <div className="w-full mt-2 flex flex-col gap-2 text-left">
        <ExerciseHowTo exercise={lookup?.(name)} />
        {exerciseNotes && (
          <ExerciseNote
            key={name}
            exercise={name}
            regions={lookup?.(name)?.body_regions ?? []}
            {...exerciseNotes}
          />
        )}
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
  goal,
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
  onLoggedChange,
  aboveClock,
  onSlotChange,
  onPhaseChange,
  restSlot,
  hideChange = false,
}: SetTimerProps) {
  const [state, setStateNow] = useState<Phase>(() =>
    readSaved(storageKey, workoutId),
  );
  // Saved straight away, not after the next render: in a plan the timer
  // moves to the next exercise's card as a set is saved, and the timer that
  // picks up there reads where this one left off.
  const setState = (next: Phase) => {
    writeSaved(storageKey, workoutId, next);
    setStateNow(next);
  };
  const [name, setName] = useState(exercise);
  // Follow the plan when it moves on to the next exercise.
  const [prevExercise, setPrevExercise] = useState(exercise);
  if (exercise !== prevExercise) {
    setPrevExercise(exercise);
    if (exercise) setName(exercise);
  }

  useEffect(
    () => writeSaved(storageKey, workoutId, state),
    [storageKey, workoutId, state],
  );

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
    setStateNow((s) =>
      s.phase !== "running" && s.rest
        ? { ...s, rest: { ...s.rest, alerted: true } }
        : s,
    );
  }, [restDue]);

  const side = sideFor(name);

  // How long the rest has run, to save with the set that ends it.
  const restUntil = (at: number) => (rest ? since(rest.since, at) : null);

  // Seconds left before a set straight after another starts timing.
  const countdown =
    state.phase === "running"
      ? Math.min(
          COUNTDOWN,
          Math.max(
            0,
            Math.ceil((onGrid(state.startedAt, clockOrigin) - now) / 1000),
          ),
        )
      : 0;
  // A short buzz as the countdown runs out and the set starts.
  const counted = useRef(countdown > 0);
  useEffect(() => {
    if (counted.current && countdown === 0) navigator.vibrate?.(150);
    counted.current = countdown > 0;
  }, [countdown]);
  const startNow = () => {
    if (state.phase === "running")
      setState({ ...state, startedAt: Date.now() });
  };

  const busy = state.phase === "running" || state.phase === "logging";
  const slot: SlotContent = state.phase === "resting" ? "rest" : "none";
  // Told before paint, so the cards around the timer change in the same frame.
  useLayoutEffect(() => onSlotChange?.(slot), [slot, onSlotChange]);
  const logged =
    (state.phase === "ready" || state.phase === "resting") && !!state.logged;
  useLayoutEffect(() => onLoggedChange?.(logged), [logged, onLoggedChange]);
  useLayoutEffect(
    () => onPhaseChange?.(state.phase),
    [state.phase, onPhaseChange],
  );

  const startSet = () => {
    const n = name.trim();
    if (!n || busy) return;
    const at = Date.now();
    setState({
      phase: "running",
      exercise: n,
      startedAt: at,
      side: sideFor(n),
      restSeconds: restUntil(at),
      rest,
    });
  };

  // After the first side, go straight to the second; rest after that.
  // In a superset, go straight to the next exercise and rest after the round.
  const restAfter = (set: SetInput) =>
    set.side === FIRST_SIDE ? { rest: 0 } : afterSet(set);

  // What comes after a saved set: the second side after the first, otherwise
  // the rest, or the next exercise straight on in a superset.
  const afterSaving = (
    set: SetInput,
    restFrom: number,
    logged: boolean,
    current?: Rest,
  ): Phase => {
    if (set.side === FIRST_SIDE)
      return { phase: "ready", switchTo: SECOND_SIDE, logged };
    const { rest: target, next } = afterSet(set);
    if (next) setName(next);
    if (target > 0)
      return {
        phase: "resting",
        rest:
          current?.target === target ? current : { since: restFrom, target },
        logged,
      };
    return {
      phase: "ready",
      supersetNext:
        next && next.toLowerCase() !== set.exercise_name.toLowerCase()
          ? next
          : undefined,
      logged,
    };
  };

  // Stopping saves the set with the timer's time and the usual numbers,
  // which can be fixed in place until the next set starts.
  const stopSet = () => {
    if (state.phase !== "running") return;
    const at = Date.now();
    const { reps = null, weight = null } = prefillFor(state.exercise);
    const set: SetInput = {
      exercise_name: state.exercise,
      reps,
      weight,
      duration_seconds: since(state.startedAt, at) || null,
      side: state.side ?? null,
    };
    onSave({ ...set, rest_seconds: state.restSeconds ?? null });
    setState(afterSaving(set, at, true));
  };

  // Starts the second side straight after the first: one tap saves the
  // first side with the timer's time and the usual numbers (fix them later
  // in the set list), and starts the second side's timer.
  const startSecondSide = () => {
    if (state.phase !== "running" || state.side !== FIRST_SIDE) return;
    const at = Date.now();
    const { reps = null, weight = null } = prefillFor(state.exercise);
    onSave({
      exercise_name: state.exercise,
      reps,
      weight,
      duration_seconds: since(state.startedAt, at) || null,
      side: FIRST_SIDE,
      rest_seconds: state.restSeconds ?? null,
    });
    setState({
      phase: "running",
      exercise: state.exercise,
      startedAt: at + COUNTDOWN * 1000,
      side: SECOND_SIDE,
      restSeconds: null,
    });
  };

  const save = (input: SetInput) => {
    if (state.phase !== "logging") return;
    onSave({ ...input, rest_seconds: state.restSeconds ?? null });
    setState(
      afterSaving(input, state.stoppedAt ?? Date.now(), false, state.rest),
    );
  };

  const restClock = rest && (
    <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
      Resting {formatClock(rested)}
      {rest.target > 0 && ` · target ${formatClock(rest.target)}`}
    </p>
  );

  const startLabel = side ? `Start ${side} side` : "Start";

  const header = (exerciseName: string, setSide?: Side | null) => (
    <ExerciseHeader
      name={exerciseName}
      side={setSide}
      target={target}
      notes={notes}
      goal={goal}
      lookup={lookup}
      exerciseNotes={exerciseNotes}
    />
  );

  const bigClock = (seconds: number) => (
    <p
      className="my-2 text-3xl font-extrabold tracking-tight tabular-nums text-center"
      role="timer"
    >
      {formatClock(seconds)}
    </p>
  );

  if (state.phase === "running")
    return (
      <div className="flex flex-col">
        {header(state.exercise, state.side)}
        {aboveClock}
        {countdown > 0 ? (
          // In the clock's place, so nothing moves when it starts.
          <>
            <p
              className="my-2 text-3xl font-extrabold tracking-tight tabular-nums text-center text-base-content/45 dark:text-base-content/70"
              role="timer"
            >
              Starting in {countdown}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
              onClick={startNow}
            >
              Start now
            </button>
          </>
        ) : (
          bigClock(since(state.startedAt))
        )}
        {countdown > 0 ? null : state.side === FIRST_SIDE ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
              onClick={startSecondSide}
            >
              Start {SECOND_SIDE} side
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 mt-1"
              onClick={stopSet}
            >
              Finish {FIRST_SIDE} side
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
            onClick={stopSet}
          >
            {/* Named for what's next: rest, when the plan has one. */}
            {restAfter({
              exercise_name: state.exercise,
              reps: null,
              weight: null,
              duration_seconds: null,
              side: state.side ?? null,
            }).rest > 0
              ? "Rest"
              : "Finish"}
          </button>
        )}
      </div>
    );

  if (state.phase === "logging")
    return (
      <div className="flex flex-col gap-2">
        {state.exercise && header(state.exercise, state.side)}
        {aboveClock}
        <SetForm
          suggestions={suggestions}
          hideExercise={!!state.exercise}
          bigTime
          aboveFields={restClock}
          initial={{
            ...prefillFor(state.exercise),
            exercise_name: state.exercise,
            duration_seconds: state.seconds,
            side: state.side ?? null,
          }}
          submitLabel="Save set"
          onCancel={() => setState({ phase: "ready", rest: state.rest })}
          onAdd={save}
        />
      </div>
    );

  if (state.phase === "resting") {
    const goal = state.rest.target;
    const restBlock = (
      <div className="flex flex-col items-center text-center">
        <p className="text-xl font-extrabold">Resting</p>
        <p
          className={`my-1 text-3xl font-extrabold tracking-tight tabular-nums ${rested >= goal ? "text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]" : ""}`}
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
        <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
          {rested >= goal
            ? `Target ${formatClock(goal)} reached. Go when you're ready.`
            : `Target ${formatClock(goal)}`}
        </p>
      </div>
    );
    const start = (
      <>
        <button
          type="button"
          className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
          onClick={startSet}
          disabled={!name.trim()}
        >
          {startLabel}
        </button>
        {!hideChange && (
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 mt-1"
            onClick={() =>
              setState({ phase: "ready", rest: state.rest, editing: true })
            }
          >
            Change exercise
          </button>
        )}
      </>
    );
    // With a rest card to go in, the rest goes there and the start button
    // stays with the exercise it starts.
    if (restSlot !== undefined)
      return (
        <div className="flex flex-col">
          {restSlot && createPortal(restBlock, restSlot)}
          {header(name.trim(), side)}
          {aboveClock}
          <div className="w-full mt-2 flex flex-col items-center">{start}</div>
        </div>
      );
    return (
      <div className="flex flex-col items-center text-center">
        {restBlock}
        {aboveClock && (
          <div className="w-full text-left mt-3">{aboveClock}</div>
        )}
        <div className="w-full mt-2 flex flex-col items-center">{start}</div>
      </div>
    );
  }

  // The exercise is a title until you choose to change it. With none yet,
  // it's a field, and stays one while you type.
  if (!state.editing && !name.trim()) setState({ ...state, editing: true });
  const editing = state.editing || !name.trim();
  return (
    <div className="flex flex-col gap-2">
      {state.rest && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold tabular-nums">
          Resting {formatClock(rested)} · target{" "}
          {formatClock(state.rest.target)}
        </p>
      )}
      {state.switchTo && side === state.switchTo && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold">
          Now the {state.switchTo} side.
        </p>
      )}
      {state.supersetNext && name === state.supersetNext && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold">
          Superset: straight on to {state.supersetNext}, no rest.
        </p>
      )}
      {editing ? (
        <>
          <ExerciseInput
            className={fieldClass}
            value={name}
            onChange={setName}
            suggestions={suggestions}
          />
          <PlanLines target={target} notes={notes} goal={goal} />
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
        </>
      ) : (
        header(name.trim(), side)
      )}
      {aboveClock}
      <button
        type="button"
        className="btn btn-primary btn-lg rounded-full font-bold active:scale-[0.98] transition"
        onClick={startSet}
        disabled={!name.trim()}
      >
        {startLabel}
      </button>
      {!editing && !hideChange && (
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75 self-center"
          onClick={() => setState({ ...state, editing: true })}
        >
          Change exercise
        </button>
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
