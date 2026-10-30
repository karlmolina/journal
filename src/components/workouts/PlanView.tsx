import { useState } from "react";
import useDraft from "../../hooks/useDraft";
import SupersetGroup from "./SupersetGroup";
import AddPlanExercise from "./AddPlanExercise";
import type { PlannedExercise, WorkoutPlan } from "../../hooks/useWorkoutPlans";
import type { Workout } from "../../hooks/useWorkouts";
import {
  bestWeight,
  dayLabel,
  describeTarget,
  moveExercise,
  supersetLetter,
  supersetRuns,
} from "../../functions/planProgress";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import { cardClass } from "../styles";

const dayActionClass =
  "btn btn-ghost btn-sm rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";

// Where an exercise is headed, how to get there, and (for weighted goals)
// how far along the heaviest logged set is from the plan's starting weight.
function GoalProgress({
  exercise: e,
  workouts,
}: {
  exercise: PlannedExercise;
  workouts: Workout[];
}) {
  if (!e.goal) return null;
  const start = e.weight ?? null;
  const goal = e.goal_weight ?? null;
  const best = bestWeight(e.name, workouts);
  const current = Math.max(best ?? 0, start ?? 0);
  const showBar = start !== null && goal !== null && goal > start;
  const pct = showBar
    ? Math.min(Math.max((current - start) / (goal - start), 0), 1) * 100
    : 0;
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <p className="text-sm font-bold">
        <span className="text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]">
          Goal
        </span>{" "}
        {e.goal}
      </p>
      {showBar && (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-1.5 rounded-full bg-base-content/10 overflow-hidden"
            role="progressbar"
            aria-label={`${e.name} progress toward ${goal} ${WEIGHT_UNIT}`}
            aria-valuemin={start}
            aria-valuemax={goal}
            aria-valuenow={current}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-base-content/60 dark:text-base-content/80">
            {best !== null ? `Best ${best}` : `Start ${start}`} / {goal}{" "}
            {WEIGHT_UNIT}
          </span>
        </div>
      )}
      {e.progression && (
        <p className="text-sm font-medium text-base-content/60 dark:text-base-content/80">
          {e.progression}
        </p>
      )}
    </div>
  );
}

export default function PlanView({
  plan,
  next,
  inProgress,
  workouts,
  suggestions,
  onLog,
  onStart,
  onAddExercise,
  onMove,
}: {
  plan: WorkoutPlan;
  // Newest first, for progress toward each exercise's goal.
  workouts: Workout[];
  next: number;
  // A workout is running, so starting another isn't possible.
  inProgress: boolean;
  // Exercise names for the add-exercise field, most recent first.
  suggestions: string[];
  onLog: (exercise: string) => void;
  onStart: (session: number) => void;
  onAddExercise: (
    session: number,
    exercise: PlannedExercise,
  ) => Promise<boolean>;
  onMove: (session: number, index: number, direction: -1 | 1) => void;
}) {
  const { title, summary, sessions, safety_notes } = plan.plan;
  // The day whose add-exercise form is open.
  const [adding, setAdding] = useDraft<number | null>(
    `plan-add:${plan.id}`,
    "day",
    null,
  );
  // The day whose exercises show up and down buttons.
  const [ordering, setOrdering] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <section className={cardClass}>
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
          {plan.days_per_week} days a week · {plan.minutes_per_session} min ·{" "}
          {new Date(plan.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        {plan.instruction && (
          <p className="mt-1 text-sm font-semibold text-base-content/60 dark:text-base-content/80">
            Updated: “{plan.instruction}”
          </p>
        )}
        <p className="mt-1 font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)]">
          {summary}
        </p>
        {safety_notes.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 rounded-xl bg-warning/12 px-3 py-2 text-sm font-medium">
            {safety_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      {sessions.map((s, i) => {
        const exerciseRow = (j: number) => {
          const e = s.exercises[j];
          return (
            <div key={j} className="flex items-start gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold">{e.name}</p>
                <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
                  {describeTarget(e)}
                  {!supersetLetter(e) &&
                    e.rest_seconds > 0 &&
                    ` · rest ${e.rest_seconds}s`}
                </p>
                {e.notes && (
                  <p className="text-sm font-medium text-base-content/70 dark:text-base-content/80">
                    {e.notes}
                  </p>
                )}
                <GoalProgress exercise={e} workouts={workouts} />
              </div>
              {ordering === i ? (
                <div className="flex gap-1 self-center">
                  {([-1, 1] as const).map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      className="btn btn-sm btn-circle bg-base-content/8 border-0 shadow-none text-base"
                      onClick={() => onMove(i, j, direction)}
                      disabled={
                        moveExercise(s.exercises, j, direction) === null
                      }
                      aria-label={`Move ${e.name} ${direction < 0 ? "up" : "down"}`}
                    >
                      {direction < 0 ? "↑" : "↓"}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] mt-0.5"
                  onClick={() => onLog(e.name)}
                  aria-label={`Log ${e.name}`}
                >
                  Log
                </button>
              )}
            </div>
          );
        };
        return (
          <section key={i} className={cardClass}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
                  {i === next && (
                    <span className="text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] font-bold">
                      Up next ·{" "}
                    </span>
                  )}
                  {dayLabel(i)} · {s.duration_minutes} min
                </p>
                <h3 className="text-lg font-bold leading-snug">{s.focus}</h3>
              </div>
              {!inProgress && (
                <button
                  type="button"
                  className={`btn btn-sm rounded-full font-bold ${
                    i === next
                      ? "btn-primary"
                      : "bg-base-content/8 border-0 shadow-none"
                  }`}
                  onClick={() => onStart(i)}
                >
                  Start
                </button>
              )}
            </div>
            <ol className="mt-2 flex flex-col gap-2">
              {supersetRuns(s.exercises).map(({ letter, indices }) => (
                <li key={indices[0]}>
                  {letter ? (
                    <SupersetGroup
                      size={indices.length}
                      progress={`${Math.max(
                        ...indices.map((j) => s.exercises[j].sets),
                      )} rounds`}
                      rest={Math.max(
                        0,
                        ...indices.map((j) => s.exercises[j].rest_seconds),
                      )}
                    >
                      <div className="flex flex-col divide-y divide-base-content/8 px-2">
                        {indices.map((j) => exerciseRow(j))}
                      </div>
                    </SupersetGroup>
                  ) : (
                    exerciseRow(indices[0])
                  )}
                </li>
              ))}
            </ol>
            {adding === i ? (
              <div className="mt-2">
                <AddPlanExercise
                  submitLabel={`Add to ${dayLabel(i)}`}
                  draft={`plan-add:${plan.id}`}
                  suggestions={suggestions}
                  onAdd={(exercise) => onAddExercise(i, exercise)}
                  onCancel={() => setAdding(null)}
                />
              </div>
            ) : (
              <div className="mt-1 -mx-2 flex justify-between">
                <button
                  type="button"
                  className={dayActionClass}
                  onClick={() => {
                    setAdding(i);
                    setOrdering(null);
                  }}
                >
                  + Add exercise
                </button>
                {s.exercises.length > 1 && (
                  <button
                    type="button"
                    className={dayActionClass}
                    onClick={() => setOrdering(ordering === i ? null : i)}
                  >
                    {ordering === i ? "Done" : "Reorder"}
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
