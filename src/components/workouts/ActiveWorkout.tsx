import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  PlanChanges,
  SetInput,
  Workout,
  WorkoutSet,
} from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import type { PlannedSession } from "../../hooks/useWorkoutPlans";
import type { Exercise } from "../../hooks/useExercises";
import type { ExerciseNotesProps } from "./ExerciseNote";
import useClock from "../../hooks/useClock";
import { formatClock } from "../../functions/formatDuration";
import {
  currentExerciseIndex,
  describeTarget,
  endExercise,
  FIRST_SIDE,
  nextSide,
  SECOND_SIDE,
  setsDone,
  swapExercise,
  type SessionExercise,
} from "../../functions/planProgress";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import {
  countSets,
  joinSupersets,
  leaveSuperset,
  nextInSuperset,
  planSupersets,
  renameInSupersets,
  splitSuperset,
  supersetOf,
  type Supersets,
} from "../../functions/supersets";
import ExerciseInput from "./ExerciseInput";
import SetList from "./SetList";
import SetTimer, { type SlotContent, type TimerPhase } from "./SetTimer";
import ExerciseHowTo from "./ExerciseHowTo";
import SupersetGroup from "./SupersetGroup";

// Brings the current exercise's card to the top of the screen, gliding
// there unless reduced motion is asked for. A glide can stop short when
// the page changes height on the way, so once the page stops moving it
// checks where the card landed and goes again, unless you've taken over.
let stopScrolling: (() => void) | null = null;
function scrollToTop(el: HTMLElement | null) {
  // The latest call wins.
  stopScrolling?.();
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  let tries = 0;
  let lastY = NaN;
  let timer = 0;
  const stop = () => {
    stopScrolling = null;
    clearTimeout(timer);
    removeEventListener("touchstart", stop);
    removeEventListener("wheel", stop);
  };
  const settle = () => {
    if (!el?.isConnected) return stop();
    // Still gliding.
    if (scrollY !== lastY) {
      lastY = scrollY;
      timer = setTimeout(settle, 120);
      return;
    }
    const off =
      el.getBoundingClientRect().top -
      parseFloat(getComputedStyle(el).scrollMarginTop || "0");
    const atBottom = innerHeight + scrollY >= document.body.scrollHeight - 1;
    if (Math.abs(off) <= 2 || (off > 0 && atBottom) || ++tries > 3)
      return stop();
    el.scrollIntoView({ behavior, block: "start" });
    lastY = NaN;
    timer = setTimeout(settle, 120);
  };
  stopScrolling = stop;
  requestAnimationFrame(() => {
    if (!el || stopScrolling !== stop) return;
    el.scrollIntoView({ behavior, block: "start" });
    addEventListener("touchstart", stop, { passive: true });
    addEventListener("wheel", stop, { passive: true });
    timer = setTimeout(settle, 120);
  });
}

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";
// Tinted to stand out: the rest you're in, and the exercise you're on.
const restCardClass =
  "rounded-2xl bg-primary/10 dark:bg-primary/15 px-4 py-4 sm:px-5";

// Rest between sets when the plan doesn't say.
const DEFAULT_REST = 90;

export interface PlannedWorkout {
  planTitle: string;
  // The plan's session with this workout's swaps and early ends applied.
  session: Omit<PlannedSession, "exercises"> & { exercises: SessionExercise[] };
}

// An exercise as the checklist counts it: one ended early needs only the
// sets already done.
type Step = SessionExercise & { planned_sets: number };

interface ActiveWorkoutProps {
  workout: Workout;
  planned?: PlannedWorkout;
  suggestions: string[];
  timerKey: string;
  prefillFor: (exercise: string) => Partial<SetInput>;
  // Whether an exercise is done one side at a time.
  isUnilateral: (exercise: string) => boolean;
  // The library entry for an exercise, for its description.
  lookup: (exercise: string) => Exercise | undefined;
  // Your own notes on exercises.
  exerciseNotes: ExerciseNotesProps;
  onPause: () => void;
  onResume: () => void;
  onFinish: (notes: string) => void;
  onDiscard: () => void;
  onSupersetsChange: (supersets: Supersets) => void;
  // A swap passes the supersets with the exercise renamed, when the workout
  // has its own.
  onPlanChange: (changes: PlanChanges, supersets?: Supersets) => void;
  initialExercise?: string;
  onAddSet: (set: SetInput) => void;
  onUpdateSet: (set: WorkoutSet, changes: SetInput) => void;
  onRemoveSets: (sets: WorkoutSet[]) => void;
  onSplitSet: (set: WorkoutSet) => void;
}

// Between two planned exercises: whether they're a superset, and a tap to
// pair them up or split them.
// A whole rest from music notation: a small block hanging from a line.
function RestIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 20 14" aria-hidden="true">
      <path
        d="M1.5 4h17"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M5 4h10v4.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

const linkButtonClass =
  "flex size-9 items-center justify-center rounded-full font-bold transition cursor-pointer text-base-content/55 dark:text-base-content/75 hover:text-base-content/80 dark:hover:text-base-content/95";

function SupersetLink({
  linked,
  onToggle,
}: {
  linked: boolean;
  onToggle: () => void;
}) {
  if (!linked)
    return (
      <div className="flex justify-center">
        <button
          type="button"
          className={`${linkButtonClass} bg-base-content/5 hover:bg-base-content/10 dark:bg-base-content/8`}
          onClick={onToggle}
          aria-pressed={false}
          aria-label="Rest between these. Tap to make them a superset."
          title="Rest between · tap to superset"
        >
          <RestIcon />
        </button>
      </div>
    );
  // Joined with no rest: a neck of card joins the two cards, with the
  // superset sign in its waist.
  return (
    <div className="relative flex justify-center h-9 -my-1">
      <svg
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 h-full w-24 text-base-content/5 dark:text-base-content/9"
        viewBox="0 0 80 28"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 0H80C62 0 56 7 56 14C56 21 62 28 80 28H0C18 28 24 21 24 14C24 7 18 0 0 0Z"
          fill="currentColor"
        />
      </svg>
      <button
        type="button"
        className={`${linkButtonClass} relative text-xl leading-none`}
        onClick={onToggle}
        aria-pressed
        aria-label="Superset, no rest between these. Tap to split them."
        title="Superset · tap to split"
      >
        ⊃
      </button>
    </div>
  );
}

const actionClass =
  "btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";
const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45 dark:placeholder:text-base-content/65";

// At the foot of each exercise's card: do it now instead of the current
// one, swap it for another for this workout, or end it before all its sets
// are done.
function StepActions({
  step,
  complete,
  suggestions,
  onPick,
  onSwap,
  onEnd,
}: {
  step: Step;
  complete: boolean;
  suggestions: string[];
  onPick?: () => void;
  onSwap: (name: string) => void;
  onEnd: (ended: boolean) => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const [name, setName] = useState("");

  if (swapping) {
    const swap = () => {
      if (!name.trim()) return;
      onSwap(name);
      setSwapping(false);
      setName("");
    };
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-base-content/5 p-2">
        <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 px-1">
          Do something else instead of {step.name}, just this workout.
        </p>
        <ExerciseInput
          className={fieldClass}
          value={name}
          onChange={setName}
          suggestions={suggestions.filter(
            (n) => n.toLowerCase() !== step.name.toLowerCase(),
          )}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full font-bold flex-1"
            onClick={() => setSwapping(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-full font-bold flex-1"
            onClick={swap}
            disabled={!name.trim()}
          >
            Swap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {onPick && (
        <button type="button" className={actionClass} onClick={onPick}>
          Do this now
        </button>
      )}
      <button
        type="button"
        className={actionClass}
        onClick={() => setSwapping(true)}
      >
        Swap exercise
      </button>
      {step.swapped_from && (
        <button
          type="button"
          className={actionClass}
          onClick={() => onSwap(step.swapped_from!)}
        >
          Back to {step.swapped_from}
        </button>
      )}
      {step.ended ? (
        <button
          type="button"
          className={actionClass}
          onClick={() => onEnd(false)}
        >
          Pick back up
        </button>
      ) : (
        !complete && (
          <button
            type="button"
            className={actionClass}
            onClick={() => onEnd(true)}
          >
            End early
          </button>
        )
      )}
    </div>
  );
}

export default function ActiveWorkout({
  workout,
  planned,
  suggestions,
  timerKey,
  prefillFor,
  isUnilateral,
  lookup,
  exerciseNotes,
  initialExercise,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onSupersetsChange,
  onPlanChange,
  onAddSet,
  onUpdateSet,
  onRemoveSets,
  onSplitSet,
}: ActiveWorkoutProps) {
  const paused = workout.paused_at !== null;
  // One clock drives the workout time and the set and rest timers.
  const clockOrigin = Date.parse(workout.started_at);
  const now = useClock(clockOrigin);
  const sets = workout.workout_sets;
  // An exercise finished early counts as done with the sets it has.
  const exercises: Step[] = (planned?.session.exercises ?? []).map((e) => ({
    ...e,
    planned_sets: e.sets,
    sets: e.ended ? Math.min(e.sets, setsDone(e, sets)) : e.sets,
  }));
  const supersets = workout.supersets ?? planSupersets(exercises);
  const indexOf = (name: string) =>
    exercises.findIndex(
      (e) => e.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  const done = (name: string, all = sets) =>
    countSets(name, isUnilateral(name), all);
  // Planned exercises have a number of sets; anything else goes on and on.
  const targetOf = (name: string) => exercises[indexOf(name)]?.sets ?? Infinity;

  // The exercise picked in the checklist; otherwise the next one in the
  // superset just done, or the first unfinished one.
  const [picked, setPicked] = useState<number | null>(null);
  const auto = (() => {
    const last = sets.at(-1);
    const group = last && supersetOf(last.exercise_name, supersets);
    if (last && group) {
      // A first side is followed by the second before moving on.
      const i =
        last.side === FIRST_SIDE &&
        nextSide(last.exercise_name, sets) === SECOND_SIDE
          ? indexOf(last.exercise_name)
          : indexOf(
              nextInSuperset(last.exercise_name, group, done, targetOf).next ??
                "",
            );
      if (i !== -1 && setsDone(exercises[i], sets) < exercises[i].sets)
        return i;
    }
    return currentExerciseIndex(exercises, sets);
  })();
  const selectedIndex = picked ?? auto;
  const selected =
    selectedIndex !== null ? exercises[selectedIndex] : undefined;
  const target =
    selected &&
    [
      `${
        supersetOf(selected.name, supersets) ? "Round" : "Set"
      } ${Math.min(setsDone(selected, sets) + 1, selected.planned_sets)} of ${selected.planned_sets}`,
      `${selected.reps}${selected.weight != null ? ` at ${selected.weight} ${WEIGHT_UNIT}` : ""}`,
    ]
      .filter(Boolean)
      .join(" · ");

  // One-side-at-a-time exercises alternate, starting with the left.
  const sideFor = (name: string) =>
    name.trim() && isUnilateral(name) ? nextSide(name, sets) : null;

  const restFor = (name: string) => {
    const e = exercises[indexOf(name)];
    return e ? e.rest_seconds : DEFAULT_REST;
  };

  // In a superset the next exercise follows with no rest, and the rest comes
  // after the round (the longest any of its exercises asks for).
  const afterSet = (set: SetInput) => {
    const group = supersetOf(set.exercise_name, supersets);
    if (!group) return { rest: restFor(set.exercise_name) };
    const all = [...sets, set as WorkoutSet];
    const { next, rest } = nextInSuperset(
      set.exercise_name,
      group,
      (n) => done(n, all),
      targetOf,
    );
    return {
      rest: rest ? Math.max(...group.map(restFor)) : 0,
      next: next ?? undefined,
    };
  };

  const supersetWith = (name: string) =>
    supersetOf(name, supersets)?.filter(
      (n) => n.trim().toLowerCase() !== name.trim().toLowerCase(),
    );

  const handleSave = (set: SetInput) => {
    onAddSet(set);
    // Once the picked exercise has all its sets, or it's in a superset, go
    // back to following the plan, which moves through the superset.
    if (supersetOf(set.exercise_name, supersets)) setPicked(null);
    else if (
      selected &&
      set.exercise_name.toLowerCase() === selected.name.toLowerCase() &&
      setsDone(selected, [...sets, set as WorkoutSet]) >= selected.sets
    )
      setPicked(null);
  };
  const [timerPhase, setTimerPhase] = useState<TimerPhase>("ready");
  const setBusy = timerPhase === "running" || timerPhase === "logging";
  // A rest gets a card of its own just above the exercise that's next.
  const [slot, setSlot] = useState<SlotContent>("none");
  const resting = slot !== "none" && !!selected;

  // Keep the current exercise at the top: when the workout opens, when the
  // plan moves on to another exercise and whenever a set starts.
  const currentCard = useRef<HTMLElement>(null);
  const [restSlot, setRestSlot] = useState<HTMLElement | null>(null);
  useEffect(() => scrollToTop(currentCard.current), [selectedIndex]);
  // During a rest its card is the top.
  useEffect(() => {
    if (restSlot) scrollToTop(restSlot);
  }, [restSlot]);
  useEffect(() => {
    if (setBusy) scrollToTop(currentCard.current);
  }, [setBusy]);
  // While the rest card above empties and goes, hold the exercise where it
  // was on screen so it glides up from there rather than jumping.
  const cardTop = useRef<{ el: HTMLElement; top: number } | null>(null);
  const wasResting = useRef(resting);
  useLayoutEffect(() => {
    const el = currentCard.current;
    const before = cardTop.current;
    if (wasResting.current && el && before?.el === el) {
      const shift = el.getBoundingClientRect().top + scrollY - before.top;
      if (shift) scrollBy({ top: shift, behavior: "instant" });
    }
    wasResting.current = resting;
    cardTop.current = el
      ? { el, top: el.getBoundingClientRect().top + scrollY }
      : null;
  });

  // Where the current exercise is when it's off screen, for the button
  // that brings it back.
  const [awayFrom, setAwayFrom] = useState<"above" | "below" | null>(null);
  const [clockCovers, setClockCovers] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = currentCard.current;
      // The current exercise's main button under the corner clock.
      const corner = innerHeight - 96;
      setClockCovers(
        [...(el?.querySelectorAll(".btn-primary") ?? [])].some((b) => {
          const r = b.getBoundingClientRect();
          return (
            r.bottom > corner &&
            r.top < innerHeight &&
            r.right > innerWidth - 140
          );
        }),
      );
      if (!el) return setAwayFrom(null);
      // Off screen, or so nearly that the button would cover it.
      const { top, bottom } = el.getBoundingClientRect();
      setAwayFrom(
        bottom < 96 ? "above" : top > innerHeight - 96 ? "below" : null,
      );
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [restSlot, selectedIndex, timerPhase]);

  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [notes, setNotes] = useState("");
  const elapsed = formatClock(elapsedSeconds(workout, now));

  // Show the running time in the browser tab too.
  useEffect(() => {
    const previous = document.title;
    document.title = `${elapsed} · Workout`;
    return () => {
      document.title = previous;
    };
  }, [elapsed]);

  const started = new Date(workout.started_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // In a plan the rest gets a card of its own above the exercise (null until
  // it's on the page); otherwise it shows in place.
  const timer = (restCard?: HTMLElement | null) => (
    <SetTimer
      workoutId={workout.id}
      storageKey={timerKey}
      now={now}
      clockOrigin={clockOrigin}
      exercise={selected?.name ?? initialExercise ?? ""}
      target={target || undefined}
      notes={selected?.notes || undefined}
      goal={selected?.goal || undefined}
      suggestions={suggestions}
      prefillFor={prefillFor}
      afterSet={afterSet}
      sideFor={sideFor}
      supersetWith={supersetWith}
      onSuperset={(name, partner) =>
        onSupersetsChange(joinSupersets(supersets, name, partner))
      }
      onLeaveSuperset={(name) =>
        onSupersetsChange(leaveSuperset(supersets, name))
      }
      lookup={lookup}
      exerciseNotes={exerciseNotes}
      onSave={handleSave}
      lastSet={sets.at(-1)}
      onUpdateSet={onUpdateSet}
      onSlotChange={setSlot}
      onPhaseChange={setTimerPhase}
      restSlot={restCard}
      // A plan's exercise cards have Swap exercise instead.
      hideChange={restCard !== undefined}
    />
  );

  const setList = (list: WorkoutSet[], newestFirst = false) => (
    <SetList
      sets={list}
      suggestions={suggestions}
      onUpdate={onUpdateSet}
      onRemove={onRemoveSets}
      onSplit={onSplitSet}
      isUnilateral={isUnilateral}
      newestFirst={newestFirst}
    />
  );

  const setsOf = (name: string) =>
    sets.filter(
      (s) => s.exercise_name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  const groupOf = (i: number) => supersetOf(exercises[i].name, supersets);
  const members = (group: string[]) =>
    exercises.filter((e) => supersetOf(e.name, [group]));
  // The rest after a round: the longest any of its exercises asks for.
  const roundRest = (group: string[]) =>
    Math.max(0, ...members(group).map((e) => e.rest_seconds));
  // Which round you're on: one past the fewest sets of anything unfinished.
  const roundOf = (group: string[]) => {
    const all = members(group);
    const rounds = Math.max(...all.map((e) => e.planned_sets));
    const open = all.filter((e) => setsDone(e, sets) < e.sets);
    if (open.length === 0) return "Done";
    const round = Math.min(...open.map((e) => setsDone(e, sets))) + 1;
    return `Round ${Math.min(round, rounds)} of ${rounds}`;
  };

  // Every exercise in the plan's order, each a card of its own: the ones
  // done sit above the current one with their sets, still editable, and
  // what's still to come sits below.
  const card = (i: number) => {
    const e = exercises[i];
    const doneSets = setsDone(e, sets);
    const complete = doneSets >= e.sets;
    const current = i === selectedIndex;
    const logged = setsOf(e.name);
    // Whether it was swapped in, and how far along it is; the current
    // exercise says which set is next under its title.
    const status = complete
      ? e.ended
        ? "Finished early"
        : "Done"
      : !current && doneSets > 0
        ? `${Math.min(doneSets, e.planned_sets)} of ${e.planned_sets} sets done`
        : null;
    const label = (e.swapped_from || status) && (
      <p className="flex justify-between gap-2 text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75 tabular-nums">
        <span>{e.swapped_from && `Instead of ${e.swapped_from}`}</span>
        <span>{status}</span>
      </p>
    );
    const loggedSets = logged.length > 0 && (
      <SetList
        sets={logged}
        suggestions={suggestions}
        onUpdate={onUpdateSet}
        onRemove={onRemoveSets}
        onSplit={onSplitSet}
        isUnilateral={isUnilateral}
        hideNames
      />
    );
    const actions = (
      <StepActions
        // A fresh form for each exercise.
        key={e.name}
        step={e}
        complete={complete}
        suggestions={suggestions}
        // Not mid-set: the timer stays with the set it's timing.
        onPick={
          !current && !complete && !setBusy ? () => setPicked(i) : undefined
        }
        onSwap={(name) => {
          onPlanChange(
            swapExercise(
              workout.plan_changes,
              i,
              name,
              e.swapped_from ?? e.name,
            ),
            workout.supersets
              ? renameInSupersets(workout.supersets, e.name, name.trim())
              : undefined,
          );
          // Swapping one that's done means it was the other exercise all
          // along, so its sets go with it.
          if (complete)
            for (const s of logged)
              onUpdateSet(s, {
                exercise_name: name.trim(),
                reps: s.reps,
                weight: s.weight,
                duration_seconds: s.duration_seconds,
                side: s.side,
              });
        }}
        onEnd={(ended) => {
          onPlanChange(endExercise(workout.plan_changes, i, ended));
          // Move on to what's next once it's done.
          if (ended && current) setPicked(null);
        }}
      />
    );

    if (current)
      return (
        <>
          {/* Rest gets a card of its own just above, and the timer, with
              the start button, stays in this one from phase to phase. */}
          {resting && (
            <section
              ref={setRestSlot}
              className={`${restCardClass} scroll-mt-4`}
            />
          )}
          <section
            ref={currentCard}
            className={`${restCardClass} scroll-mt-4 flex flex-col gap-3`}
          >
            {label}
            {timer(resting ? restSlot : null)}
            {loggedSets}
            {!setBusy && actions}
          </section>
        </>
      );

    const group = groupOf(i);
    return (
      <section className={`${cardClass} flex flex-col gap-2`}>
        {label}
        <div>
          <p
            className={`text-xl font-bold leading-tight ${complete ? "text-base-content/70 dark:text-base-content/85" : ""}`}
          >
            {e.name}
          </p>
          <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
            {describeTarget({ ...e, sets: e.planned_sets })}
            {!group && e.rest_seconds > 0 && ` · rest ${e.rest_seconds}s`}
          </p>
          {!complete && e.notes && (
            <p className="text-sm font-medium text-base-content/60 dark:text-base-content/80">
              {e.notes}
            </p>
          )}
          {!complete && e.goal && (
            <p className="text-sm font-medium text-base-content/60 dark:text-base-content/80">
              Goal: {e.goal}
            </p>
          )}
        </div>
        {!complete && <ExerciseHowTo exercise={lookup(e.name)} />}
        {loggedSets}
        {actions}
      </section>
    );
  };

  // Exercises next to each other in the same superset share one outline.
  const runs: { group?: string[]; indices: number[] }[] = [];
  exercises.forEach((_, i) => {
    const group = groupOf(i);
    const last = runs.at(-1);
    if (group && last?.group === group) last.indices.push(i);
    else runs.push({ group, indices: [i] });
  });
  // Exercises done that aren't in the plan, each with a card where it was
  // done: before the first plan exercise started after it, and never below
  // the current one.
  const offPlan: { name: string; at: number }[] = [];
  for (const set of sets) {
    if (indexOf(set.exercise_name) !== -1) continue;
    const k = set.exercise_name.trim().toLowerCase();
    if (offPlan.some((o) => o.name.trim().toLowerCase() === k)) continue;
    const first = set.created_at;
    const later = exercises.findIndex((e) => {
      const start = setsOf(e.name)[0]?.created_at;
      return !start || start > first;
    });
    const at = later === -1 ? exercises.length : later;
    offPlan.push({
      name: set.exercise_name,
      at: selectedIndex === null ? at : Math.min(at, selectedIndex),
    });
  }
  // Placed between runs, so a superset's outline stays whole.
  const runStart = (i: number) =>
    runs.find((r) => r.indices.includes(i))?.indices[0] ?? exercises.length;
  const offPlanBefore = (start: number) =>
    offPlan
      .filter((o) => runStart(o.at) === start)
      .map((o) => (
        <li key={`off:${o.name}`}>
          <section className={`${cardClass} flex flex-col gap-2`}>
            <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
              Not in the plan
            </p>
            <p className="text-xl font-bold leading-tight">{o.name}</p>
            <SetList
              sets={setsOf(o.name)}
              suggestions={suggestions}
              onUpdate={onUpdateSet}
              onRemove={onRemoveSets}
              onSplit={onSplitSet}
              isUnilateral={isUnilateral}
              hideNames
            />
          </section>
        </li>
      ));

  const link = (i: number, linked: boolean) => (
    <SupersetLink
      linked={linked}
      onToggle={() =>
        onSupersetsChange(
          linked
            ? splitSuperset(supersets, exercises[i].name)
            : joinSupersets(
                supersets,
                exercises[i - 1].name,
                exercises[i].name,
              ),
        )
      }
    />
  );
  const timeline = (
    <ol className="flex flex-col gap-1">
      {runs.map(({ group, indices }) => [
        ...offPlanBefore(indices[0]),
        <li key={indices[0]} className="flex flex-col gap-1">
          {indices[0] > 0 && link(indices[0], false)}
          {group ? (
            <SupersetGroup
              size={group.length}
              progress={roundOf(group)}
              rest={roundRest(group)}
            >
              <div className="flex flex-col gap-1 pt-1">
                {indices.map((i, k) => (
                  <div key={i} className="flex flex-col gap-1">
                    {k > 0 && link(i, true)}
                    {card(i)}
                  </div>
                ))}
              </div>
            </SupersetGroup>
          ) : (
            card(indices[0])
          )}
        </li>,
      ])}
      {offPlanBefore(exercises.length)}
    </ol>
  );

  return (
    <div className="flex flex-col gap-3">
      {finishing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/70 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          onClick={() => setFinishing(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Workout"
            className="w-full max-w-md rounded-2xl bg-base-100 dark:bg-base-200 p-4 flex flex-col items-center text-center gap-2 shadow-xl ring-1 ring-base-content/10"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setFinishing(false)}
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
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex gap-2 w-full">
              <button
                type="button"
                className="btn btn-ghost rounded-full font-bold flex-1"
                onClick={() => setFinishing(false)}
                autoFocus
              >
                Keep going
              </button>
              <button
                type="button"
                className="btn btn-primary rounded-full font-bold flex-1"
                onClick={() => onFinish(notes)}
              >
                Finish workout
              </button>
            </div>
          </section>
        </div>
      )}

      {planned ? (
        <>
          <div className="px-1 pt-1">
            <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
              {planned.planTitle} · {planned.session.day}
            </p>
            <h2 className="font-bold">{planned.session.focus}</h2>
          </div>
          {timeline}
          {selectedIndex === null && (
            <>
              {exercises.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="text-sm font-bold text-center text-base-content/70 dark:text-base-content/85">
                    Every planned set is done. Nice work.
                  </p>
                  <button
                    type="button"
                    className={actionClass}
                    onClick={() => setFinishing(true)}
                  >
                    Finish workout
                  </button>
                </div>
              )}
              <section
                ref={currentCard}
                className={`${resting ? restCardClass : cardClass} scroll-mt-4`}
              >
                {timer()}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <section ref={currentCard} className={`${cardClass} scroll-mt-4`}>
            {timer()}
          </section>
          {sets.length > 0 && (
            <section className={cardClass}>{setList(sets, true)}</section>
          )}
        </>
      )}

      <div className="flex justify-center pb-6">
        {confirmDiscard ? (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-base-content/60 dark:text-base-content/80">
              Delete this workout?
            </span>
            <button
              type="button"
              className="btn btn-sm btn-error rounded-full font-bold"
              onClick={onDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost rounded-full font-bold"
              onClick={() => setConfirmDiscard(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55 dark:text-base-content/75"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard workout
          </button>
        )}
      </div>
      {/* Along the bottom: the way back to the current exercise in the
          middle, and the workout clock in the corner, which opens pause and
          finish. The clock steps aside while a button sits under it. */}
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none">
        <span />
        {awayFrom ? (
          <button
            type="button"
            className="pointer-events-auto btn btn-primary rounded-full font-bold px-6 shadow-lg active:scale-[0.98] transition"
            onClick={() => scrollToTop(restSlot ?? currentCard.current)}
          >
            {awayFrom === "above" ? "↑" : "↓"} Current exercise
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={`justify-self-end h-10 rounded-full px-4 text-base font-bold tabular-nums shadow-lg ring-1 ring-base-content/10 bg-base-100 dark:bg-base-300 cursor-pointer transition active:scale-95 ${
            clockCovers ? "opacity-0" : "pointer-events-auto"
          } ${paused ? "text-base-content/50 dark:text-base-content/70" : ""}`}
          onClick={() => setFinishing(true)}
          aria-label={`Workout time ${elapsed}${paused ? ", paused" : ""}. Open to pause or finish.`}
          aria-hidden={clockCovers || undefined}
          tabIndex={clockCovers ? -1 : undefined}
        >
          {paused && "Paused · "}
          {elapsed}
        </button>
      </div>
      {/* Room to scroll the current exercise to the top near the end. */}
      <div aria-hidden className="h-[75dvh]" />
    </div>
  );
}
