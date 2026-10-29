import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  PlanChanges,
  SetInput,
  Workout,
  WorkoutSet,
} from "../../hooks/useWorkouts";
import { elapsedSeconds } from "../../hooks/useWorkouts";
import type {
  PlannedExercise,
  PlannedSession,
} from "../../hooks/useWorkoutPlans";
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
import SetList from "./SetList";
import Chip from "../Chip";
import SetForm from "./SetForm";
import SetTimer, { type SlotContent, type TimerPhase } from "./SetTimer";
import ExerciseHowTo from "./ExerciseHowTo";
import SupersetGroup from "./SupersetGroup";
import AddPlanExercise from "./AddPlanExercise";
import StepActions, { actionClass, type Step } from "./StepActions";
import SupersetLink from "./SupersetLink";
import FloatingBar from "./FloatingBar";
import WorkoutClockDialog from "./WorkoutClockDialog";
import scrollToTop, { isGliding } from "../../functions/scrollToTop";
import { sameName } from "../../functions/exerciseName";

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
  // Adds an exercise to this workout, or to its plan day too.
  onAddExercise: (
    exercise: PlannedExercise,
    toPlan: boolean,
  ) => Promise<boolean>;
  initialExercise?: string;
  onAddSet: (set: SetInput) => void;
  onUpdateSet: (set: WorkoutSet, changes: SetInput) => void;
  onRemoveSets: (sets: WorkoutSet[]) => void;
  onSplitSet: (set: WorkoutSet) => void;
}

// Between two planned exercises: whether they're a superset, and a tap to
// pair them up or split them.
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
  onAddExercise,
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
    exercises.findIndex((e) => sameName(e.name, name));
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
    supersetOf(name, supersets)?.filter((n) => !sameName(n, name));

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
  // Read by the scrolling below, which can run before the phase's state does.
  const phaseNow = useRef<TimerPhase>("ready");
  const onPhaseChange = useCallback((phase: TimerPhase) => {
    phaseNow.current = phase;
    setTimerPhase(phase);
  }, []);
  const setBusy = timerPhase === "running" || timerPhase === "logging";
  // A rest shows in the next exercise's card, on its start button.
  const [slot, setSlot] = useState<SlotContent>("none");
  const [fixingLast, setFixingLast] = useState(false);
  const resting = slot !== "none" && !!selected;
  // The set just stopped, fixable in place until the next one starts.
  const fixing = fixingLast ? sets.at(-1) : undefined;
  // Its exercise stays the current card until you go on, even when that
  // was its last set and the plan has moved on.
  const held =
    timerPhase === "done" && fixing ? indexOf(fixing.exercise_name) : -1;
  const shownIndex = held !== -1 ? held : selectedIndex;
  const shown = shownIndex !== null ? exercises[shownIndex] : undefined;
  // Which set it is: the one just done while it's being fixed, else the next.
  const setLabel =
    shown &&
    `${supersetOf(shown.name, supersets) ? "Round" : "Set"} ${Math.min(
      setsDone(shown, held !== -1 ? sets.filter((s) => s !== fixing) : sets) +
        1,
      shown.planned_sets,
    )} of ${shown.planned_sets}`;
  const target =
    shown &&
    `${setLabel} · ${shown.reps}${shown.weight != null ? ` at ${shown.weight} ${WEIGHT_UNIT}` : ""}`;

  // Keep the current exercise at the top: when the workout opens, when the
  // plan moves on to another exercise and whenever a set starts.
  const currentCard = useRef<HTMLElement>(null);
  // Under the set just finished, for the button on to the rest or next set.
  const [doneSlot, setDoneSlot] = useState<HTMLElement | null>(null);
  const doneBlock = (timerPhase === "done" && doneSlot?.parentElement) || null;
  const doneRef = useRef(doneBlock);
  doneRef.current = doneBlock;
  const toCurrent = () => currentCard.current;
  // When the plan moves on, a rest starts or a set starts; one scroll for
  // all of them, once the page settles.
  // A set just finished stays where it is (the how-to folds to make room
  // for it) until you go on.
  const seen = useRef<{
    index: number | null;
    rest: boolean;
    busy: boolean;
  }>(null);
  useEffect(() => {
    const before = seen.current;
    seen.current = {
      index: selectedIndex,
      rest: resting,
      busy: setBusy,
    };
    if (phaseNow.current === "done") return;
    if (
      !before ||
      before.index !== selectedIndex ||
      (resting && !before.rest) ||
      (setBusy && !before.busy)
    )
      scrollToTop(toCurrent);
  });
  // While a rest starts and ends, the cards above can change (the set just
  // finished leaves); hold the exercise where it was on screen so the page
  // glides from there rather than jumping. The clocks re-render every
  // second, so only a real move counts (phones scroll in fractions of a
  // pixel), and never during a glide, which the nudge would stop.
  const cardTop = useRef<{ el: HTMLElement; top: number } | null>(null);
  const wasResting = useRef(resting);
  useLayoutEffect(() => {
    const el = currentCard.current;
    const before = cardTop.current;
    if ((wasResting.current || resting) && el && before?.el === el) {
      const shift = el.getBoundingClientRect().top + scrollY - before.top;
      if (Math.abs(shift) >= 1 && !isGliding())
        scrollBy({ top: shift, behavior: "instant" });
    }
    wasResting.current = resting;
    cardTop.current = el
      ? { el, top: el.getBoundingClientRect().top + scrollY }
      : null;
  });

  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The add-exercise form, and whether it adds to the plan day too.
  const [adding, setAdding] = useState(false);
  const [addToPlan, setAddToPlan] = useState(false);
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

  // In a plan the rest shows in the exercise's card, under its title and
  // sets; otherwise it heads the timer.
  const timer = (inPlan = false, aboveClock?: ReactNode) => (
    <SetTimer
      workoutId={workout.id}
      storageKey={timerKey}
      now={now}
      clockOrigin={clockOrigin}
      exercise={selected?.name ?? initialExercise ?? ""}
      target={target || undefined}
      setLabel={setLabel || undefined}
      notes={shown?.notes || undefined}
      goal={shown?.goal || undefined}
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
      onLoggedChange={setFixingLast}
      aboveClock={aboveClock}
      onSlotChange={setSlot}
      onPhaseChange={onPhaseChange}
      restInCard={inPlan}
      doneSlot={doneSlot}
      // A plan's exercise cards have Swap exercise instead.
      hideChange={inPlan}
    />
  );

  // The set just stopped, fixable in place until the next one starts: its
  // time on the big clock, side, reps and weight, saving as they change.
  const fixingEditor = (s: WorkoutSet) => (
    <div className="flex flex-col gap-2 animate-fade-in">
      <div className="flex flex-col rounded-2xl bg-base-content/5 p-3">
        <SetForm
          key={s.id}
          suggestions={suggestions}
          hideExercise
          bigTime
          goalSeconds={prefillFor(s.exercise_name).duration_seconds}
          initial={s}
          rest={s.rest_seconds != null}
          onChange={(changes) => onUpdateSet(s, changes)}
        />
      </div>
      {/* Right under it: on to the rest or the next set. */}
      <div ref={setDoneSlot} className="empty:hidden" />
    </div>
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
    sets.filter((s) => sameName(s.exercise_name, name));

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
    const current = i === shownIndex;
    const next = i === selectedIndex;
    const logged = setsOf(e.name);
    // Whether it was swapped in, and how far along it is; the current
    // exercise says which set is next under its title.
    const status =
      complete && !current
        ? e.ended
          ? "Finished early"
          : "Done"
        : !current && doneSets > 0
          ? `${Math.min(doneSets, e.planned_sets)} of ${e.planned_sets} sets done`
          : null;
    const label = (e.swapped_from || e.added || status) && (
      <p className="flex justify-between gap-2 text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75 tabular-nums">
        <span>
          {e.swapped_from
            ? `Instead of ${e.swapped_from}`
            : e.added && "Just today"}
        </span>
        <span>{status}</span>
      </p>
    );
    // Its sets so far, the one just stopped last and fixable.
    const earlier = logged.filter((s) => s.id !== fixing?.id);
    const loggedSets = logged.length > 0 && (
      <div className="flex flex-col gap-2">
        {earlier.length > 0 && (
          <SetList
            sets={earlier}
            suggestions={suggestions}
            onUpdate={onUpdateSet}
            onRemove={onRemoveSets}
            onSplit={onSplitSet}
            isUnilateral={isUnilateral}
            hideNames
          />
        )}
        {fixing && earlier.length < logged.length && fixingEditor(fixing)}
      </div>
    );
    const actions = (
      <StepActions
        // A fresh form for each exercise.
        key={e.name}
        step={e}
        complete={complete}
        suggestions={suggestions}
        // Not mid-set: the timer stays with the set it's timing.
        onPick={!next && !complete && !setBusy ? () => setPicked(i) : undefined}
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
          if (ended && next) setPicked(null);
        }}
      />
    );

    if (current)
      return (
        // The timer, with the rest and the start button, stays in this card
        // from phase to phase.
        <section
          ref={currentCard}
          className={`${restCardClass} scroll-mt-4 flex flex-col gap-3`}
        >
          {label}
          {timer(true, loggedSets)}
          {!setBusy && actions}
        </section>
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
    if (offPlan.some((o) => sameName(o.name, set.exercise_name))) continue;
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
        <WorkoutClockDialog
          paused={paused}
          started={started}
          elapsed={elapsed}
          notes={notes}
          onNotesChange={setNotes}
          onPause={onPause}
          onResume={onResume}
          onClose={() => setFinishing(false)}
          onFinish={() => onFinish(notes)}
        />
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
          {adding ? (
            <AddPlanExercise
              submitLabel={addToPlan ? `Add to ${planned.session.day}` : "Add"}
              above={
                <div className="flex flex-wrap gap-1.5" role="group">
                  <Chip
                    selected={!addToPlan}
                    onClick={() => setAddToPlan(false)}
                  >
                    Just today
                  </Chip>
                  <Chip selected={addToPlan} onClick={() => setAddToPlan(true)}>
                    Every {planned.session.day}
                  </Chip>
                </div>
              }
              suggestions={suggestions}
              onAdd={(exercise) => onAddExercise(exercise, addToPlan)}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] self-center"
              onClick={() => {
                setAdding(true);
                setAddToPlan(false);
              }}
            >
              + Add exercise
            </button>
          )}
          {shownIndex === null && (
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
                {timer(undefined, fixing && fixingEditor(fixing))}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <section ref={currentCard} className={`${cardClass} scroll-mt-4`}>
            {timer(undefined, fixing && fixingEditor(fixing))}
          </section>
          {sets.length > (fixing ? 1 : 0) && (
            <section className={cardClass}>
              {setList(
                sets.filter((s) => s !== fixing),
                true,
              )}
            </section>
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
      <FloatingBar
        currentCard={currentCard}
        doneBlock={doneBlock}
        elapsed={elapsed}
        paused={paused}
        onCurrent={() =>
          doneBlock
            ? scrollToTop(() => doneRef.current)
            : scrollToTop(toCurrent)
        }
        onClock={() => setFinishing(true)}
      />
      {/* Room to scroll the current exercise to the top near the end. Sized
          to the small viewport so it holds still while the browser bar
          slides away mid-scroll. */}
      <div aria-hidden className="h-[75svh]" />
    </div>
  );
}
