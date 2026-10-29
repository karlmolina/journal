import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SetInput, Side } from "../../hooks/useWorkouts";
import type { Exercise } from "../../hooks/useExercises";
import { onGrid } from "../../hooks/useClock";
import { formatClock } from "../../functions/formatDuration";
import { FIRST_SIDE, SECOND_SIDE } from "../../functions/planProgress";
import SetForm, { ClockRow, RepsWeightFields } from "./SetForm";
import ExerciseInput from "./ExerciseInput";
import ExerciseHowTo from "./ExerciseHowTo";
import ExerciseNote, { type ExerciseNotesProps } from "./ExerciseNote";
import ExerciseHeader, { PlanLines } from "./ExerciseHeader";
import RestStartButton, { primaryClass } from "./RestStartButton";
import SupersetControl from "./SupersetControl";
import {
  readSaved,
  writeSaved,
  type Phase,
  type Rest,
} from "../../functions/setTimerState";
import { boldFieldClass } from "../styles";

const text = (n: number | null | undefined) => (n == null ? "" : String(n));

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
  // A line about the target, like "Set 2 of 3 · 8-10 reps", and just the
  // set, "Set 2 of 3", for once it's going and the fields show the rest.
  target?: string;
  setLabel?: string;
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
  // Whether a rest is on.
  onSlotChange?: (content: SlotContent) => void;
  // What the timer is doing: ready, running, logging or resting.
  onPhaseChange?: (phase: TimerPhase) => void;
  // In a plan's exercise card the rest goes under the title and sets, just
  // over the start button; otherwise it heads the timer.
  restInCard?: boolean;
  // Just under the set just finished, for the button that goes on to the
  // rest or the next set; without one it shows in place.
  doneSlot?: HTMLElement | null;
  // In a plan, Swap exercise on the card picks another exercise instead.
  hideChange?: boolean;
}

export type TimerPhase = Phase["phase"];
export type SlotContent = "none" | "rest";

export default function SetTimer({
  workoutId,
  storageKey,
  now,
  clockOrigin,
  exercise,
  target,
  setLabel,
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
  restInCard = false,
  doneSlot,
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

  const rest =
    state.phase === "running" || state.phase === "done"
      ? undefined
      : state.rest;
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
      s.phase !== "running" && s.phase !== "done" && s.rest
        ? { ...s, rest: { ...s.rest, alerted: true } }
        : s,
    );
  }, [restDue]);

  const side = sideFor(name);

  // How long the rest has run, to save with the set that ends it.
  const restUntil = (at: number) => (rest ? since(rest.since, at) : null);

  // Seconds left before a set straight after another starts timing.
  const countdown =
    state.phase === "running" && state.countdown
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
      setState({ ...state, startedAt: Date.now(), countdown: false });
  };

  const busy = state.phase === "running" || state.phase === "logging";
  const slot: SlotContent = state.phase === "resting" ? "rest" : "none";
  // Told before paint, so the cards around the timer change in the same frame.
  useLayoutEffect(() => onSlotChange?.(slot), [slot, onSlotChange]);
  const logged =
    state.phase === "done" ||
    ((state.phase === "ready" || state.phase === "resting") && !!state.logged);
  useLayoutEffect(() => onLoggedChange?.(logged), [logged, onLoggedChange]);
  useLayoutEffect(
    () => onPhaseChange?.(state.phase),
    [state.phase, onPhaseChange],
  );

  // The plan's reps and weight for a set, to start its fields with.
  const planned = (n: string) => {
    const { reps, weight } = prefillFor(n);
    return { reps: text(reps), weight: text(weight) };
  };

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
      ...planned(n),
    });
  };

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
    const { reps, weight } = { ...planned(state.exercise), ...state };
    const set: SetInput = {
      exercise_name: state.exercise,
      reps: /^\s*[1-9]\d*\s*$/.test(reps) ? Number(reps) : null,
      weight: /^\s*\d+(\.\d+)?\s*$/.test(weight) ? Number(weight) : null,
      duration_seconds: since(state.startedAt, at) || null,
      side: state.side ?? null,
    };
    onSave({ ...set, rest_seconds: state.restSeconds ?? null });
    setState({
      phase: "done",
      exercise: state.exercise,
      side: state.side,
      then: afterSaving(set, at, true),
    });
  };

  // From the set just finished on to the rest (which began when the set
  // stopped), or straight into the next set after a short countdown.
  const carryOn = () => {
    if (state.phase !== "done") return;
    const n = name.trim();
    if (state.then.phase === "resting" || !n) return setState(state.then);
    setState({
      phase: "running",
      exercise: n,
      startedAt: Date.now() + COUNTDOWN * 1000,
      countdown: true,
      side: sideFor(n),
      restSeconds: null,
      ...planned(n),
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

  // Once a set is going its reps and weight are in the fields below, so the
  // title only says which set it is.
  const going = state.phase === "running" || state.phase === "done";
  const header = (exerciseName: string, setSide?: Side | null) => (
    <ExerciseHeader
      name={exerciseName}
      side={setSide}
      target={going ? (setLabel ?? target) : target}
      notes={notes}
      goal={goal}
      lookup={lookup}
      exerciseNotes={exerciseNotes}
      // Room for the set just finished, without scrolling to it.
      foldHowTo={state.phase === "done"}
    />
  );

  if (state.phase === "running") {
    const fields = { ...planned(state.exercise), ...state };
    return (
      <div className="flex flex-col">
        {header(state.exercise, state.side)}
        {aboveClock}
        {/* Laid out like the set once it's done, so nothing moves on Finish. */}
        <div
          className={`${aboveClock ? "mt-2" : ""} mb-2 flex flex-col gap-2 rounded-2xl bg-base-content/5 p-3`}
        >
          <ClockRow
            goalSeconds={prefillFor(state.exercise).duration_seconds}
            clock={
              <p
                className={`my-1 px-4 py-1 text-4xl font-extrabold tracking-tight tabular-nums text-center ${countdown > 0 ? "text-base-content/45 dark:text-base-content/70" : ""}`}
                role="timer"
              >
                {countdown > 0
                  ? `Starting in ${countdown}`
                  : formatClock(since(state.startedAt))}
              </p>
            }
          />
          <RepsWeightFields
            big
            reps={fields.reps}
            weight={fields.weight}
            onReps={(reps) => setState({ ...state, ...fields, reps })}
            onWeight={(weight) => setState({ ...state, ...fields, weight })}
          />
        </div>
        {countdown > 0 ? (
          <button type="button" className={primaryClass} onClick={startNow}>
            Start now
          </button>
        ) : (
          // Finishing a first side too: fix it, then start the second.
          <button type="button" className={primaryClass} onClick={stopSet}>
            Finish
          </button>
        )}
      </div>
    );
  }

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

  if (state.phase === "done") {
    // Named for what's next.
    const label =
      state.then.phase === "resting"
        ? "Rest"
        : name.trim().toLowerCase() !== state.exercise.toLowerCase()
          ? "Next exercise"
          : side
            ? `Start ${side} side`
            : "Next set";
    const button = (
      <button type="button" className={primaryClass} onClick={carryOn}>
        {label}
      </button>
    );
    // No start button here: the one button is under the set just finished.
    // Moving on to another exercise, this card stays the one just done
    // until you go on.
    const same = name.trim().toLowerCase() === state.exercise.toLowerCase();
    return (
      <div className="flex flex-col">
        {same
          ? name.trim() && header(name.trim(), side)
          : header(state.exercise, state.side)}
        {aboveClock}
        {doneSlot ? (
          createPortal(button, doneSlot)
        ) : (
          <div className="mt-2">{button}</div>
        )}
      </div>
    );
  }

  if (state.phase === "resting") {
    const goal = state.rest.target;
    // The rest's clock, in the set clock's place; the start button under it
    // fills as it goes.
    const restBlock = (
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
          {rested >= goal
            ? `Rested · target ${formatClock(goal)} reached`
            : `Resting · target ${formatClock(goal)}`}
        </p>
        <p
          className="my-1 text-3xl font-extrabold tracking-tight tabular-nums"
          role="timer"
        >
          {formatClock(rested)}
        </p>
      </div>
    );
    const start = (
      <>
        <RestStartButton
          label={startLabel}
          progress={goal > 0 ? rested / goal : 1}
          onClick={startSet}
          disabled={!name.trim()}
        />
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
    // In the next exercise's card: what it is and its sets, then the rest
    // and the button that starts it.
    if (restInCard)
      return (
        <div className="flex flex-col">
          {header(name.trim(), side)}
          {aboveClock}
          <div className="w-full mt-2 flex flex-col items-center">
            {restBlock}
            {start}
          </div>
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
      {editing ? (
        <>
          <ExerciseInput
            className={boldFieldClass}
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
        className={primaryClass}
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
