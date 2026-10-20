import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export interface PlannedExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
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
  "id, goals, days_per_week, minutes_per_session, equipment, plan, created_at";

// What to tell the person for each error the Edge Function can return.
const MESSAGES: Record<string, string> = {
  missing_api_key:
    "AI planning isn't set up yet: the Anthropic API key hasn't been added to Supabase.",
  bad_api_key: "The Anthropic API key in Supabase was rejected.",
  rate_limited: "Claude is busy right now. Try again in a minute.",
  declined: "Claude couldn't write a plan for that. Try rewording your goals.",
  not_signed_in: "Your session expired. Sign in again and retry.",
};

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

  const generate = useCallback(async (request: PlanRequest) => {
    setGenerating(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("plan-workout", {
      body: request,
    });
    setGenerating(false);
    if (error) {
      console.error(error);
      let code = "";
      if (error instanceof FunctionsHttpError)
        code = await error.context
          .json()
          .then((b: { error?: string }) => b.error ?? "")
          .catch(() => "");
      setError(MESSAGES[code] ?? "Couldn't make a plan. Try again.");
      return false;
    }
    setPlans((prev) => [data as WorkoutPlan, ...prev]);
    return true;
  }, []);

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
    removePlan,
  };
}
