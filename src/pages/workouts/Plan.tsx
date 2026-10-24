import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Chip from "../../components/Chip";
import ErrorBanner from "../../components/ErrorBanner";
import { useAuth } from "../../context/AuthContext";
import useWorkoutPlans, {
  type PlanRequest,
  type WorkoutPlan,
} from "../../hooks/useWorkoutPlans";

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [20, 30, 45, 60, 90];

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";
const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none transition focus:bg-base-content/12 placeholder:text-base-content/45";
const label = "text-xs font-semibold tracking-wide text-base-content/55";

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
        <p className="text-sm font-medium text-base-content/55">
          Claude reads your injuries and recent workouts, then writes a weekly
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
      {generating && (
        <p className="text-xs font-medium text-center text-base-content/55">
          This usually takes under a minute.
        </p>
      )}
    </form>
  );
}

function PlanView({
  plan,
  onLog,
}: {
  plan: WorkoutPlan;
  onLog: (exercise: string) => void;
}) {
  const { title, summary, sessions, safety_notes } = plan.plan;
  return (
    <div className="flex flex-col gap-3">
      <section className={cardClass}>
        <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70">
          {plan.days_per_week} days a week · {plan.minutes_per_session} min ·{" "}
          {new Date(plan.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
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
          <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70">
            {s.day} · {s.duration_minutes} min
          </p>
          <h3 className="text-lg font-bold leading-snug">{s.focus}</h3>
          <ol className="mt-2 flex flex-col divide-y divide-base-content/8">
            {s.exercises.map((e, j) => (
              <li key={j} className="flex items-start gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{e.name}</p>
                  <p className="text-sm font-semibold text-base-content/60 tabular-nums">
                    {e.sets} × {e.reps}
                    {e.rest_seconds > 0 && ` · rest ${e.rest_seconds}s`}
                  </p>
                  {e.notes && (
                    <p className="text-sm font-medium text-base-content/70">
                      {e.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs rounded-full font-bold text-primary mt-0.5"
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
    dismissError,
    generate,
    removePlan,
  } = useWorkoutPlans(user?.id);
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
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

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
        <div className="flex justify-center py-4 text-base-content/40">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      )}

      {selected && !showForm && (
        <PlanView
          plan={selected}
          onLog={(exercise) => navigate("/workouts", { state: { exercise } })}
        />
      )}

      {older.length > 0 && !showForm && (
        <>
          <h2 className="mt-3 ml-1 text-sm font-bold tracking-wide text-base-content/60">
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
                <p className="text-xs font-semibold text-base-content/55">
                  {new Date(p.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/55"
                onClick={() => removePlan(p)}
              >
                Delete
              </button>
            </div>
          ))}
        </>
      )}

      <p className="text-xs font-medium text-base-content/50 text-center px-4">
        Plans are written by AI and aren't medical advice. Check with a
        professional before training through an injury.
      </p>
    </div>
  );
}
