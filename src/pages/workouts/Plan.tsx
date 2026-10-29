import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import { PlanForm, ReviseForm } from "../../components/workouts/PlanForms";
import PlanView from "../../components/workouts/PlanView";
import { useAuth } from "../../context/AuthContext";
import useWorkoutPlans, {
  type PlannedExercise,
  type PlanRequest,
  type WorkoutPlan,
} from "../../hooks/useWorkoutPlans";
import useWorkouts from "../../hooks/useWorkouts";
import useInjuries from "../../hooks/useInjuries";
import useExercises from "../../hooks/useExercises";
import usePlanPreferences, {
  DEFAULT_PREFERENCES,
} from "../../hooks/usePlanPreferences";
import { buildPlanPrompt } from "../../functions/planPrompt";
import {
  grewFrom,
  moveExercise,
  movedTo,
  nextSessionIndex,
  followPlanEdit,
} from "../../functions/planProgress";
import { exerciseSuggestions } from "../../functions/exerciseSuggestions";

export default function Plan() {
  const { user } = useAuth();
  const {
    plans,
    loading,
    saving,
    error,
    dismissError,
    importPlan,
    addExercise,
    saveSession,
    removePlan,
  } = useWorkoutPlans(user?.id);
  const { active, history, start, setPlanChanges } = useWorkouts(user?.id);
  const { injuries } = useInjuries(user?.id);
  const { exercises, byLowerName, ensureExercise } = useExercises(user?.id);
  const { preferences, save: savePreferences } = usePlanPreferences(user?.id);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  const suggestions = useMemo(
    () =>
      exerciseSuggestions(active ? [active, ...history] : history, exercises),
    [active, history, exercises],
  );

  // A name that isn't in the library yet is added as your own exercise, and
  // one that is takes the library's spelling.
  const handleAddExercise = (
    plan: WorkoutPlan,
    session: number,
    exercise: PlannedExercise,
  ) => {
    const found = byLowerName.get(exercise.name.toLowerCase());
    if (!found) ensureExercise(exercise.name, false);
    const changes = followPlanEdit(
      active,
      plan,
      session,
      grewFrom(plan.plan.sessions[session].exercises.length),
    );
    // Right away, so a quick second edit starts from it.
    if (changes) setPlanChanges(changes);
    return addExercise(plan, session, {
      ...exercise,
      name: found?.name ?? exercise.name,
    });
  };

  // Moving an exercise also keeps a running workout of that day pointing at
  // the same exercises for its swaps and early ends.
  const handleMove = (
    plan: WorkoutPlan,
    session: number,
    index: number,
    direction: -1 | 1,
  ) => {
    const moved = moveExercise(
      plan.plan.sessions[session].exercises,
      index,
      direction,
    );
    if (!moved) return;
    const changes = followPlanEdit(active, plan, session, movedTo(moved.from));
    if (changes) setPlanChanges(changes);
    saveSession(plan, session, moved.exercises, "Couldn't reorder the plan.");
  };

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
            suggestions={suggestions}
            onLog={(exercise) => navigate("/workouts", { state: { exercise } })}
            onAddExercise={(session, exercise) =>
              handleAddExercise(selected, session, exercise)
            }
            onMove={(session, index, direction) =>
              handleMove(selected, session, index, direction)
            }
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
