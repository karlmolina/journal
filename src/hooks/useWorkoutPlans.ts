import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabase";

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
  // Set when the AI rewrote an earlier plan on request.
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

// What to tell the person for each error the Edge Function can return.
const MESSAGES: Record<string, string> = {
  missing_api_key:
    "AI planning isn't set up yet: the Gemini API key hasn't been added to Supabase.",
  bad_api_key: "The Gemini API key in Supabase was rejected.",
  rate_limited:
    "Gemini's free limit is used up for now. Try again in a minute, or tomorrow if you've hit the daily limit.",
  daily_limit: "You've made 20 plans in the last day. Try again tomorrow.",
  model_unavailable:
    "Your Gemini key can't use this model. Set GEMINI_MODEL in Supabase to one your key covers, like gemini-3.8-flash.",
  declined: "Gemini couldn't write a plan for that. Try rewording your goals.",
  not_signed_in: "Your session expired. Sign in again and retry.",
  not_a_member: "Redeem an invite code to use AI planning.",
  plan_not_found: "That plan was deleted. Pick another one.",
  ai_timeout: "Gemini took too long to answer. Try again in a minute.",
};

// A little longer than the function's own limit on Gemini, so its answer
// normally arrives first; this only catches a request that hangs.
const PLAN_TIMEOUT_MS = 150_000;

function readCache(userId: string): WorkoutPlan[] {
  try {
    return JSON.parse(localStorage.getItem(`${CACHE_KEY}_${userId}`) ?? "[]");
  } catch {
    return [];
  }
}

function writeCache(userId: string, plans: WorkoutPlan[]) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(plans));
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export default function useWorkoutPlans(userId?: string) {
  const [plans, setPlans] = useState<WorkoutPlan[]>(() =>
    userId ? readCache(userId) : [],
  );
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
        setPlans(data as WorkoutPlan[]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Either a new plan from a request, or a rewrite of an existing plan.
  const callAI = useCallback(async (body: object) => {
    setGenerating(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("plan-workout", {
      body,
      timeout: PLAN_TIMEOUT_MS,
    });
    setGenerating(false);
    if (error) {
      console.error(error);
      // The function answers { error: code }; the gateway in front of it
      // answers { message }. Unknown errors keep their detail on screen so
      // they can be reported.
      let code = error.context?.name === "AbortError" ? "ai_timeout" : "";
      let detail = error.message;
      if (error instanceof FunctionsHttpError) {
        const res: Response = error.context;
        const b: { error?: string; message?: string } = await res
          .json()
          .catch(() => ({}));
        code = b.error ?? "";
        detail = `${res.status} ${b.error ?? b.message ?? ""}`.trim();
      }
      setError(
        MESSAGES[code] ?? `Couldn't make a plan (${detail}). Try again.`,
      );
      return false;
    }
    setPlans((prev) => [data as WorkoutPlan, ...prev]);
    return true;
  }, []);

  const generate = useCallback(
    (request: PlanRequest) => callAI(request),
    [callAI],
  );

  const revise = useCallback(
    (plan: WorkoutPlan, instruction: string) =>
      callAI({ plan_id: plan.id, instruction }),
    [callAI],
  );

  const removePlan = useCallback(async (plan: WorkoutPlan) => {
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    setError(null);
    const { error } = await supabase
      .from("workout_plans")
      .delete()
      .eq("id", plan.id);
    if (error) {
      console.error(error);
      setPlans((prev) =>
        [...prev, plan].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      );
      setError("Couldn't delete that plan.");
    }
  }, []);

  return {
    plans,
    loading,
    generating,
    error,
    dismissError: () => setError(null),
    generate,
    revise,
    removePlan,
  };
}
