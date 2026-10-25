import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { notDeleted, queueDelete } from "../functions/undoDelete";

export interface PlannedExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
  // Progression fields; plans written before they existed don't have them.
  // Weight to use now and the goal's weight, in lb; null when not weighted.
  weight?: number | null;
  goal?: string;
  goal_weight?: number | null;
  // The rule for moving toward the goal.
  progression?: string;
  // Done one side at a time: each set is a left and a right.
  unilateral?: boolean;
  // Exercises sharing a letter ("A") are a superset; "" or missing is none.
  superset?: string;
}

export interface PlannedSession {
  day: string;
  focus: string;
  duration_minutes: number;
  exercises: PlannedExercise[];
}

export interface WorkoutPlan {
  id: string;
  goals: string;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string | null;
  plan: {
    title: string;
    summary: string;
    sessions: PlannedSession[];
    safety_notes: string[];
  };
  // Set when an earlier plan was rewritten on request.
  revised_from: string | null;
  instruction: string | null;
  created_at: string;
}

export interface PlanRequest {
  goals: string;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string;
}

const CACHE_KEY = "workout_plans";
const SELECT =
  "id, goals, days_per_week, minutes_per_session, equipment, plan, revised_from, instruction, created_at";

const readCache = (userId: string) =>
  readUserCache<WorkoutPlan[]>(CACHE_KEY, userId, []);

const writeCache = (userId: string, value: WorkoutPlan[]) =>
  writeUserCache(CACHE_KEY, userId, value);

export default function useWorkoutPlans(userId?: string) {
  const [plans, setPlans] = useState<WorkoutPlan[]>(() =>
    userId ? readCache(userId) : [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) writeCache(userId, plans);
  }, [userId, plans]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("workout_plans")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error(error);
          setError("Couldn't load your plans.");
          return;
        }
        setPlans((data as WorkoutPlan[]).filter(notDeleted("workout_plans")));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Saves a plan pasted from a chatbot, as new or as a revision of `from`.
  const importPlan = useCallback(
    async (
      plan: WorkoutPlan["plan"],
      request: PlanRequest,
      revision?: { from: WorkoutPlan; instruction: string },
    ) => {
      setSaving(true);
      setError(null);
      const { data, error } = await supabase
        .from("workout_plans")
        .insert({
          goals: request.goals,
          // A revision can add or drop days.
          days_per_week: revision
            ? Math.min(Math.max(plan.sessions.length, 1), 7)
            : request.days_per_week,
          minutes_per_session: request.minutes_per_session,
          equipment: request.equipment || null,
          plan,
          revised_from: revision?.from.id ?? null,
          instruction: revision?.instruction ?? null,
        })
        .select(SELECT)
        .single();
      setSaving(false);
      if (error) {
        console.error(error);
        setError("Couldn't save that plan. Try importing it again.");
        return false;
      }
      setPlans((prev) => [data as WorkoutPlan, ...prev]);
      return true;
    },
    [],
  );

  const removePlan = useCallback((plan: WorkoutPlan) => {
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    setError(null);
    queueDelete({
      message: "Plan deleted",
      rows: [`workout_plans:${plan.id}`],
      commit: () => supabase.from("workout_plans").delete().eq("id", plan.id),
      undo: () =>
        setPlans((prev) =>
          prev.some((p) => p.id === plan.id)
            ? prev
            : [...prev, plan].sort((a, b) =>
                b.created_at.localeCompare(a.created_at),
              ),
        ),
      onError: (error) => {
        console.error(error);
        setError("Couldn't delete that plan.");
      },
    });
  }, []);

  return {
    plans,
    loading,
    saving,
    error,
    dismissError: () => setError(null),
    importPlan,
    removePlan,
  };
}
