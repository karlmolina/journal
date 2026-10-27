import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Chip from "../../components/Chip";
import ErrorBanner from "../../components/ErrorBanner";
import SupersetGroup from "../../components/workouts/SupersetGroup";
import { useAuth } from "../../context/AuthContext";
import useWorkoutPlans, {
  type PlannedExercise,
  type PlanRequest,
  type WorkoutPlan,
} from "../../hooks/useWorkoutPlans";
import useWorkouts, { type Workout } from "../../hooks/useWorkouts";
import useInjuries from "../../hooks/useInjuries";
import useExercises from "../../hooks/useExercises";
import usePlanPreferences, {
  DEFAULT_PREFERENCES,
} from "../../hooks/usePlanPreferences";
import { buildPlanPrompt, parsePlanReply } from "../../functions/planPrompt";
import {
  bestWeight,
  describeTarget,
  dayLabel,
  nextSessionIndex,
} from "../../functions/planProgress";
import { WEIGHT_UNIT } from "../../functions/workoutSets";

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [20, 30, 45, 60, 90];

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";
const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none transition focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65";
const label =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

// Copies the prompt for a chatbot. When the clipboard is blocked, the prompt
// shows in a box to copy by hand.
function CopyPrompt({
  getPrompt,
  disabled,
}: {
  getPrompt: () => string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  const copy = async () => {
    const prompt = getPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setManual(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setManual(prompt);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn btn-primary rounded-full font-bold"
        onClick={copy}
        disabled={disabled}
      >
        {copied ? "Copied. Paste it into a chatbot" : "Copy prompt"}
      </button>
      {manual !== null && (
        <textarea
          className={`${fieldClass} resize-none font-mono text-xs`}
          rows={6}
          readOnly
          value={manual}
          onFocus={(e) => e.target.select()}
          aria-label="Prompt to copy"
        />
      )}
    </div>
  );
}

// Where the chatbot's reply goes. It's checked before anything is saved, and
// what's wrong is listed so the person can ask the bot to fix it.
function PasteReply({
  saving,
  onImport,
}: {
  saving: boolean;
  onImport: (plan: WorkoutPlan["plan"]) => Promise<boolean>;
}) {
  const [reply, setReply] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const handleImport = async () => {
    const result = parsePlanReply(reply);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (await onImport(result.plan)) setReply("");
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={`${fieldClass} resize-none font-mono text-xs`}
        rows={4}
        placeholder="Paste the chatbot's reply here"
        value={reply}
        onChange={(e) => {
          setReply(e.target.value);
          setErrors([]);
        }}
        aria-label="Chatbot reply"
        disabled={saving}
      />
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-error/15 px-3 py-2 text-sm font-semibold"
        >
          <p>That reply can't be imported yet:</p>
          <ul className="mt-1 list-disc pl-5 font-medium">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {errors.length > 8 && (
            <p className="mt-1 font-medium">…and {errors.length - 8} more.</p>
          )}
          <p className="mt-1 font-medium">
            You can paste these back to the chatbot and ask it to fix them.
          </p>
        </div>
      )}
      <button
        type="button"
        className="btn rounded-full font-bold bg-base-content/8 border-0 shadow-none"
        onClick={handleImport}
        disabled={!reply.trim() || saving}
      >
        {saving ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            Saving…
          </>
        ) : (
          "Import plan"
        )}
      </button>
    </div>
  );
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <p className={label}>
    {n}. {children}
  </p>
);

function PlanForm({
  initial,
  saving,
  buildPrompt,
  onSavePreferences,
  onImport,
  onCancel,
}: {
  initial: PlanRequest;
  saving: boolean;
  buildPrompt: (request: PlanRequest) => string;
  onSavePreferences: (request: PlanRequest) => void;
  onImport: (
    plan: WorkoutPlan["plan"],
    request: PlanRequest,
  ) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [goals, setGoals] = useState(initial.goals);
  const [days, setDays] = useState(initial.days_per_week);
  const [minutes, setMinutes] = useState(initial.minutes_per_session);
  const [equipment, setEquipment] = useState(initial.equipment);

  const request = (): PlanRequest => ({
    goals: goals.trim(),
    days_per_week: days,
    minutes_per_session: minutes,
    equipment: equipment.trim(),
  });

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="font-bold">Plan my training</h2>
        <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
          Copy a prompt with your goals, injuries and recent workouts into any
          chatbot, then paste its reply back here.
        </p>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={3}
        placeholder="Your goals, like: Get back to running 5k without my knee hurting, and build some upper body strength."
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        onBlur={() => onSavePreferences(request())}
        aria-label="Goals"
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
      <textarea
        className={`${fieldClass} resize-none`}
        rows={2}
        placeholder="Equipment, like dumbbells and a band (optional)"
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
        onBlur={() => onSavePreferences(request())}
        aria-label="Equipment"
      />
      <Step n={1}>
        Copy the prompt into ChatGPT, Claude, Gemini or another chatbot
      </Step>
      <CopyPrompt
        disabled={!goals.trim()}
        getPrompt={() => {
          onSavePreferences(request());
          return buildPrompt(request());
        }}
      />
      <Step n={2}>Paste its reply</Step>
      <PasteReply
        saving={saving}
        onImport={(plan) => {
          onSavePreferences(request());
          return onImport(plan, request());
        }}
      />
      {onCancel && (
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function ReviseForm({
  saving,
  buildPrompt,
  onImport,
}: {
  saving: boolean;
  buildPrompt: (instruction: string) => string;
  onImport: (
    plan: WorkoutPlan["plan"],
    instruction: string,
  ) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState("");

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="font-bold">Change this plan</h2>
        <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
          Say what to change. The prompt includes this plan, so the chatbot
          keeps the rest, and your current version stays under earlier plans.
        </p>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={3}
        placeholder="Like: Swap running for cycling, make Day 3 shorter, and add more core work."
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        aria-label="What to change"
      />
      <Step n={1}>Copy the prompt into a chatbot</Step>
      <CopyPrompt
        disabled={!instruction.trim()}
        getPrompt={() => buildPrompt(instruction.trim())}
      />
      <Step n={2}>Paste its reply</Step>
      <PasteReply
        saving={saving}
        onImport={async (plan) => {
          const ok = await onImport(
            plan,
            instruction.trim() || "Changed in a chatbot",
          );
          if (ok) setInstruction("");
          return ok;
        }}
      />
    </div>
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

// A plan exercise's superset letter, if it's in one.
const letterOf = (e: PlannedExercise) =>
  e.superset?.trim().toUpperCase() || undefined;

// Exercises in a row that share a superset letter, kept together.
function runsOf(exercises: PlannedExercise[]) {
  const runs: { letter?: string; indices: number[] }[] = [];
  exercises.forEach((e, j) => {
    const last = runs.at(-1);
    if (last && letterOf(e) && last.letter === letterOf(e))
      last.indices.push(j);
    else runs.push({ letter: letterOf(e), indices: [j] });
  });
  return runs;
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

      {sessions.map((s, i) => {
        const exerciseRow = (j: number) => {
          const e = s.exercises[j];
          return (
            <div key={j} className="flex items-start gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold">{e.name}</p>
                <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 tabular-nums">
                  {describeTarget(e)}
                  {!letterOf(e) &&
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
              <button
                type="button"
                className="btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] mt-0.5"
                onClick={() => onLog(e.name)}
                aria-label={`Log ${e.name}`}
              >
                Log
              </button>
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
              {runsOf(s.exercises).map(({ letter, indices }) => (
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
          </section>
        );
      })}
    </div>
  );
}

export default function Plan() {
  const { user } = useAuth();
  const {
    plans,
    loading,
    saving,
    error,
    dismissError,
    importPlan,
    removePlan,
  } = useWorkoutPlans(user?.id);
  const { active, history, start } = useWorkouts(user?.id);
  const { injuries } = useInjuries(user?.id);
  const { exercises } = useExercises(user?.id);
  const { preferences, save: savePreferences } = usePlanPreferences(user?.id);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  const selected = plans.find((p) => p.id === selectedId) ?? plans[0];
  const older = plans.filter((p) => p !== selected);
  const showForm = planning || (!loading && plans.length === 0);

  const prompt = (
    request: PlanRequest,
    current?: WorkoutPlan,
    instruction?: string,
  ) =>
    buildPlanPrompt({
      request,
      injuries,
      workouts: history,
      exercises,
      currentPlan: current?.plan,
      instruction,
    });

  // A revision keeps the plan's own goals and equipment.
  const requestFor = (p: WorkoutPlan): PlanRequest => ({
    goals: p.goals,
    days_per_week: p.days_per_week,
    minutes_per_session: p.minutes_per_session,
    equipment: p.equipment ?? "",
  });

  // The latest plan's settings stand in until saved preferences load.
  const formInitial: PlanRequest =
    preferences ?? (plans[0] ? requestFor(plans[0]) : DEFAULT_PREFERENCES);

  const handleImport = async (
    plan: WorkoutPlan["plan"],
    request: PlanRequest,
  ) => {
    if (await importPlan(plan, request)) {
      setSelectedId(null);
      setPlanning(false);
      return true;
    }
    return false;
  };

  return (
    <div className="flex flex-col gap-3 pb-6">
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      {showForm ? (
        <PlanForm
          key={preferences ? "saved" : "default"}
          initial={formInitial}
          saving={saving}
          buildPrompt={(request) => prompt(request)}
          onSavePreferences={savePreferences}
          onImport={handleImport}
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
            key={selected.id}
            saving={saving}
            buildPrompt={(instruction) =>
              prompt(requestFor(selected), selected, instruction)
            }
            onImport={async (plan, instruction) => {
              const ok = await importPlan(plan, requestFor(selected), {
                from: selected,
                instruction,
              });
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
