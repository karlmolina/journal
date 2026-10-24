import { useEffect, useState } from "react";
import type { SetInput, Side } from "../../hooks/useWorkouts";
import type { Exercise } from "../../hooks/useExercises";
import useTick from "../../hooks/useTick";
import { formatClock } from "../../functions/formatDuration";
import { sideLabel } from "../../functions/planProgress";
import SetForm from "./SetForm";
import ExerciseInput from "./ExerciseInput";
import ExerciseHowTo from "./ExerciseHowTo";
import ExerciseNote from "./ExerciseNote";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45";

// What the timer is doing. Times are epoch milliseconds so the clocks stay
// right across reloads and while the phone is locked.
// `side` is set for exercises done one side at a time. `supersetNext` is
// the exercise that follows straight on in a superset.
type Phase =
  | {
      phase: "ready";
      restOver?: boolean;
      switchTo?: Side;
      supersetNext?: string;
    }
  | {
      phase: "running";
      exercise: string;
      startedAt: number;
      side?: Side | null;
    }
  | {
      phase: "logging";
      exercise: string;
      seconds: number | null;
      side?: Side | null;
    }
  | { phase: "resting"; endsAt: number; total: number };

interface Saved {
  workoutId: string;
  state: Phase;
}

function readSaved(key: string, workoutId: string): Phase {
  try {
    const saved: Saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved?.workoutId === workoutId) return saved.state;
  } catch {
    // Start fresh.
  }
  return { phase: "ready" };
}

// Browsers only play sound after a tap, so the context is created on one.
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
  } catch {
    // No sound then; the vibration and the screen still say rest is over.
  }
}

function restOverAlert() {
  navigator.vibrate?.([200, 100, 200]);
  if (!audio) return;
  const t = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.3, t + i * 0.3 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + i * 0.3);
    osc.stop(t + i * 0.3 + 0.22);
  }
}

const seconds = (ms: number) => Math.max(0, Math.round(ms / 1000));

interface SetTimerProps {
  workoutId: string;
  storageKey: string;
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
  noteFor?: (exercise: string) => string | undefined;
  onSaveNote?: (exercise: string, note: string) => void;
  onSave: (set: SetInput) => void;
}

// Pairs the current exercise with another one, or shows what it's paired with.
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
  const linkClass = "btn btn-ghost btn-xs rounded-full font-bold text-primary";

  if (partners?.length)
    return (
      <div className="flex items-center justify-center gap-1 text-sm font-semibold text-base-content/60">
        <span className="truncate">Superset with {partners.join(", ")}</span>
        <button type="button" className={linkClass} onClick={onLeave}>
          Remove
        </button>
      </div>
    );

  if (!adding)
    return (
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
    setPartner("");
    setAdding(false);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-base-content/5 p-2">
      <p className="text-sm font-semibold text-base-content/60 px-1">
        Do a set of each in turn, then rest.
      </p>
      <ExerciseInput
        className={fieldClass}
        value={partner}
        onChange={setPartner}
        suggestions={suggestions.filter(
          (n) => n.toLowerCase() !== exercise.toLowerCase(),
        )}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-bold flex-1"
          onClick={() => setAdding(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm rounded-full font-bold flex-1"
          onClick={add}
          disabled={!partner.trim()}
        >
          Pair up
        </button>
      </div>
    </div>
  );
}

export default function SetTimer({
  workoutId,
  storageKey,
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
  noteFor,
  onSaveNote,
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

  useTick(state.phase === "running" || state.phase === "resting", 250);
  const now = Date.now();
  const restLeft = state.phase === "resting" ? state.endsAt - now : 0;

  useEffect(() => {
    if (state.phase !== "resting" || restLeft > 0) return;
    restOverAlert();
    setState({ phase: "ready", restOver: true });
  }, [state.phase, restLeft]);

  const side = sideFor(name);

  const startSet = () => {
    if (!name.trim()) return;
    unlockAudio();
    setState({
      phase: "running",
      exercise: name.trim(),
      startedAt: now,
      side,
    });
  };

  // After the left side, go straight to the right; rest after the right.
  // In a superset, go straight to the next exercise and rest after the round.
  const save = (set: SetInput) => {
    onSave(set);
    if (set.side === "left") {
      setState({ phase: "ready", switchTo: "right" });
      return;
    }
    const { rest, next } = afterSet(set);
    if (next) setName(next);
    setState(
      rest > 0
        ? { phase: "resting", endsAt: Date.now() + rest * 1000, total: rest }
        : {
            phase: "ready",
            supersetNext:
              next && next.toLowerCase() !== set.exercise_name.toLowerCase()
                ? next
                : undefined,
          },
    );
  };

  const startLabel = side ? `Start ${side} side` : "Start set";

  if (state.phase === "running")
    return (
      <div className="flex flex-col items-center text-center">
        <p className="font-bold">{state.exercise}</p>
        {state.side && (
          <p className="text-sm font-bold text-primary">
            {sideLabel(state.side)}
          </p>
        )}
        {target && (
          <p className="text-sm font-semibold text-base-content/60">{target}</p>
        )}
        <div className="w-full mt-2 flex flex-col gap-2 text-left">
          <ExerciseHowTo exercise={lookup?.(state.exercise)} />
          {onSaveNote && (
            <ExerciseNote
              key={state.exercise}
              note={noteFor?.(state.exercise)}
              onSave={(note) => onSaveNote(state.exercise, note)}
            />
          )}
        </div>
        <p
          className="my-2 text-5xl font-extrabold tracking-tight tabular-nums"
          role="timer"
        >
          {formatClock(seconds(now - state.startedAt))}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-lg rounded-full font-bold w-full active:scale-[0.98] transition"
          onClick={() =>
            setState({
              phase: "logging",
              exercise: state.exercise,
              seconds: seconds(Date.now() - state.startedAt) || null,
              side: state.side,
            })
          }
        >
          Stop set
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 mt-1"
          onClick={() => setState({ phase: "ready" })}
        >
          Cancel set
        </button>
      </div>
    );

  if (state.phase === "logging")
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-base-content/60">
          {state.side && `${sideLabel(state.side)}. `}
          {state.seconds
            ? `That set took ${formatClock(state.seconds)}. Check the numbers and save it.`
            : "Fill in the set and save it."}
        </p>
        <SetForm
          suggestions={suggestions}
          initial={{
            ...prefillFor(state.exercise),
            exercise_name: state.exercise,
            duration_seconds: state.seconds,
            side: state.side ?? null,
          }}
          submitLabel="Save set"
          onCancel={() => setState({ phase: "ready" })}
          onAdd={save}
        />
      </div>
    );

  if (state.phase === "resting")
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70">
          Rest
        </p>
        <p
          className="my-1 text-5xl font-extrabold tracking-tight tabular-nums"
          role="timer"
        >
          {formatClock(Math.ceil(restLeft / 1000))}
        </p>
        <div className="w-full h-1.5 rounded-full bg-base-content/10 overflow-hidden mb-3">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${(restLeft / (state.total * 1000)) * 100}%` }}
          />
        </div>
        {name && (
          <p className="text-sm font-semibold text-base-content/60 mb-2">
            Next: {name}
            {target && ` · ${target}`}
          </p>
        )}
        <div className="flex gap-2 w-full">
          <button
            type="button"
            className="btn rounded-full font-bold flex-1 bg-base-content/8 border-0 shadow-none"
            onClick={() =>
              setState({
                ...state,
                endsAt: state.endsAt + 15_000,
                total: state.total + 15,
              })
            }
          >
            +15s
          </button>
          <button
            type="button"
            className="btn rounded-full font-bold flex-1 bg-base-content/8 border-0 shadow-none"
            onClick={() => setState({ phase: "ready" })}
          >
            Skip rest
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary rounded-full font-bold w-full mt-2"
          onClick={startSet}
          disabled={!name.trim()}
        >
          {side ? startLabel : "Start next set"}
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {state.restOver && (
        <p className="rounded-xl bg-primary/12 px-3 py-2 text-sm font-bold text-center">
          Rest's over. Time for the next set.
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
      {(target || notes) && (
        <p className="text-sm font-semibold text-base-content/60">
          {[target, notes].filter(Boolean).join(" · ")}
        </p>
      )}
      <ExerciseHowTo exercise={lookup?.(name)} />
      {onSaveNote && name.trim() && (
        <ExerciseNote
          key={name.trim().toLowerCase()}
          note={noteFor?.(name)}
          onSave={(note) => onSaveNote(name, note)}
        />
      )}
      <button
        type="button"
        className="btn btn-primary btn-lg rounded-full font-bold active:scale-[0.98] transition"
        onClick={startSet}
        disabled={!name.trim()}
      >
        {startLabel}
      </button>
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
        className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 self-center"
        onClick={() =>
          setState({
            phase: "logging",
            exercise: name.trim(),
            seconds: null,
            side,
          })
        }
      >
        Log a set without the timer
      </button>
    </div>
  );
}
