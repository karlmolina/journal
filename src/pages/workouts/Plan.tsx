import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Chip from "../../components/Chip";
import ErrorBanner from "../../components/ErrorBanner";
import { useAuth } from "../../context/AuthContext";
import useWorkoutPlans, {
  type PlannedExercise,
  type PlanRequest,
  type WorkoutPlan,
} from "../../hooks/useWorkoutPlans";
import useWorkouts, { type Workout } from "../../hooks/useWorkouts";
import {
  bestWeight,
  describeTarget,
  nextSessionIndex,
} from "../../functions/planProgress";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import { formatClock } from "../../functions/formatDuration";
import useTick from "../../hooks/useTick";

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [20, 30, 45, 60, 90];

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";
const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none transition focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65";
const label =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

// Shown while Gemini works, so a slow answer reads as progress, not a hang.
// It mounts when the request starts, so its own clock is the elapsed time.
function Waiting() {
  const [startedAt] = useState(() => Date.now());
  useTick(true);
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  return (
    <p
      className="text-xs font-medium text-center text-base-content/55 dark:text-base-content/75"
      aria-live="polite"
    >
      <span className="tabular-nums font-semibold">{formatClock(seconds)}</span>
      {" · "}
      {seconds < 60
        ? "Usually 20 to 60 seconds."
        : "Still working. It stops and tells you if Gemini doesn't answer within 2½ minutes."}
    </p>
  );
}

function PlanForm({
  initial,
  generating,
  onSubmit,
  onCancel,
}: {
  initial?: WorkoutPlan;
  generating: boolean;
  onSubmit: (request: PlanRequest) => void;
  onCancel?: () => void;
}) {
  const [goals, setGoals] = useState(initial?.goals ?? "");
  const [days, setDays] = useState(initial?.days_per_week ?? 3);
  const [minutes, setMinutes] = useState(initial?.minutes_per_session ?? 45);
  const [equipment, setEquipment] = useState(initial?.equipment ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goals.trim() || generating) return;
    onSubmit({
      goals: goals.trim(),
      days_per_week: days,
      minutes_per_session: minutes,
      equipment: equipment.trim(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`${cardClass} flex flex-col gap-3`}
    >
      <div>
        <h2 className="font-bold">Plan my training</h2>
        <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
          Gemini reads your injuries and recent workouts, then writes a weekly
          plan around them.
        </p>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={3}
        placeholder="Your goals, like: Get back to running 5k without my knee hurting, and build some upper body strength."
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        aria-label="Goals"
        disabled={generating}
      />
      <div className="flex flex-col gap-1.5">
        <span className={label}>Days a week</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <Chip key={d} selected={days === d} onClick={() => setDays(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Minutes per workout</span>
        <div className="flex flex-wrap gap-1.5">
          {MINUTES.map((m) => (
            <Chip
              key={m}
              selected={minutes === m}
              onClick={() => setMinutes(m)}
            >
              {m}
            </Chip>
          ))}
        </div>
      </div>
      <input
        className={fieldClass}
        placeholder="Equipment, like dumbbells and a band (optional)"
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
        aria-label="Equipment"
        disabled={generating}
      />
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost rounded-full font-bold flex-1"
            onClick={onCancel}
            disabled={generating}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary rounded-full font-bold flex-1"
          disabled={!goals.trim() || generating}
        >
          {generating ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Writing your plan…
            </>
          ) : (
            "Make my plan"
          )}
        </button>
      </div>
      {generating && <Waiting />}
    </form>
  );
}

function ReviseForm({
  generating,
  onSubmit,
}: {
  generating: boolean;
  onSubmit: (instruction: string) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || generating) return;
    if (await onSubmit(instruction.trim())) setInstruction("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`${cardClass} flex flex-col gap-3`}
    >
      <div>
        <h2 className="font-bold">Change this plan</h2>
        <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
          Tell Gemini what to change. It keeps the rest, and your current
          version stays under earlier plans.
        </p>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={3}
        placeholder="Like: Swap running for cycling, make Thursday 30 minutes, and add more core work."
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        aria-label="What to change"
        disabled={generating}
      />
      <button
        type="submit"
        className="btn btn-primary rounded-full font-bold"
        disabled={!instruction.trim() || generating}
      >
        {generating ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            Updating your plan…
          </>
        ) : (
          "Update plan"
        )}
      </button>
      {generating && <Waiting />}
    </form>
  );
}

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

function PlanView({
  plan,
  next,
  inProgress,
  workouts,
  onLog,
  onStart,
}: {
  plan: WorkoutPlan;
  // Newest first, for progress toward each exercise's goal.
  workouts: Workout[];
  next: number;
  // A workout is running, so starting another isn't possible.
  inProgress: boolean;
  onLog: (exercise: string) => void;
  onStart: (session: number) => void;
}) {
  const { title, summary, sessions, safety_notes } = plan.plan;
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

      {sessions.map((s, i) => (
        <section key={i} className={cardClass}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
                {i === next && (
                  <span className="text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] font-bold">
                    Up next ·{" "}
                  </span>
                )}
                {s.day} · {s.duration_minutes} min
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
          <ol className="mt-2 flex flex-col divide-y divide-base-content/8">
            {s.exercises.map((e, j) => (
              <li key={j} className="flex items-start gap-3 py-2">
                <div className="flex-1 min-w-0">
                  {e.superset?.trim() && (
                    <p className="text-xs font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]">
                      Superset {e.superset.trim().toUpperCase()}
                    </p>
                  )}
                  <p className="font-bold">{e.name}</p>
                  <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
                    {describeTarget(e)}
                    {e.rest_seconds > 0 &&
                      (!e.superset?.trim()
                        ? ` · rest ${e.rest_seconds}s`
                        : s.exercises[j + 1]?.superset?.trim().toUpperCase() !==
                            e.superset.trim().toUpperCase() &&
                          ` · then rest ${e.rest_seconds}s`)}
                  </p>
                  {e.notes && (
                    <p className="text-sm font-medium text-base-content/70 dark:text-base-content/80">
                      {e.notes}
                    </p>
                  )}
                  <GoalProgress exercise={e} workouts={workouts} />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] mt-0.5"
                  onClick={() => onLog(e.name)}
                  aria-label={`Log ${e.name}`}
                >
                  Log
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function Plan() {
  const { user } = useAuth();
  const {
    plans,
    loading,
    generating,
    error,
    errorDetails,
    dismissError,
    generate,
    revise,
    removePlan,
  } = useWorkoutPlans(user?.id);
  const { active, history, start } = useWorkouts(user?.id);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  const selected = plans.find((p) => p.id === selectedId) ?? plans[0];
  const older = plans.filter((p) => p !== selected);
  const showForm = planning || (!loading && plans.length === 0);

  const handleSubmit = async (request: PlanRequest) => {
    if (await generate(request)) {
      setSelectedId(null);
      setPlanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-6">
      {error && (
        <ErrorBanner
          message={error}
          details={errorDetails}
          onDismiss={dismissError}
        />
      )}

      {showForm ? (
        <PlanForm
          initial={plans[0]}
          generating={generating}
          onSubmit={handleSubmit}
          onCancel={plans.length > 0 ? () => setPlanning(false) : undefined}
        />
      ) : (
        <button
          type="button"
          className="btn btn-primary rounded-full font-bold self-center"
          onClick={() => setPlanning(true)}
        >
          Make a new plan
        </button>
      )}

      {loading && plans.length === 0 && (
        <div className="flex justify-center py-4 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      )}

      {active && !showForm && (
        <button
          type="button"
          className="rounded-2xl bg-primary/12 px-4 py-3 text-sm font-bold text-left cursor-pointer"
          onClick={() => navigate("/workouts")}
        >
          A workout is in progress. Go to it →
        </button>
      )}

      {selected && !showForm && (
        <>
          <PlanView
            plan={selected}
            next={nextSessionIndex(selected, plans, history)}
            inProgress={active !== null}
            workouts={active ? [active, ...history] : history}
            onLog={(exercise) => navigate("/workouts", { state: { exercise } })}
            onStart={async (session) => {
              await start({ plan_id: selected.id, plan_session: session });
              navigate("/workouts");
            }}
          />
          <ReviseForm
            generating={generating}
            onSubmit={async (instruction) => {
              const ok = await revise(selected, instruction);
              if (ok) setSelectedId(null);
              return ok;
            }}
          />
        </>
      )}

      {older.length > 0 && !showForm && (
        <>
          <h2 className="mt-3 ml-1 text-sm font-bold tracking-wide text-base-content/60 dark:text-base-content/80">
            Earlier plans
          </h2>
          {older.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-2xl bg-base-content/5 dark:bg-base-content/9 pl-4 pr-2 py-2"
            >
              <button
                type="button"
                className="flex-1 min-w-0 text-left cursor-pointer"
                onClick={() => setSelectedId(p.id)}
              >
                <p className="font-bold truncate">{p.plan.title}</p>
                <p className="text-xs font-semibold text-base-content/55 dark:text-base-content/75 truncate">
                  {new Date(p.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {p.instruction && ` · ${p.instruction}`}
                </p>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55 dark:text-base-content/75"
                onClick={() => removePlan(p)}
              >
                Delete
              </button>
            </div>
          ))}
        </>
      )}

      <p className="text-xs font-medium text-base-content/50 dark:text-base-content/75 text-center px-4">
        Plans are written by AI and aren't medical advice. Check with a
        professional before training through an injury.
      </p>
    </div>
  );
}
