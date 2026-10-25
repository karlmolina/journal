import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import type { PlanRequest } from "./useWorkoutPlans";
import { reportError } from "../functions/reportError";

const CACHE_KEY = "workout_plan_preferences";
const SELECT = "goals, equipment, days_per_week, minutes_per_session";

export const DEFAULT_PREFERENCES: PlanRequest = {
  goals: "",
  equipment: "",
  days_per_week: 3,
  minutes_per_session: 45,
};

const same = (a: PlanRequest, b: PlanRequest) =>
  a.goals === b.goals &&
  a.equipment === b.equipment &&
  a.days_per_week === b.days_per_week &&
  a.minutes_per_session === b.minutes_per_session;

// The goals, equipment, days and minutes the Plan form starts from, kept per
// person in the database so they carry across devices.
export default function usePlanPreferences(userId?: string) {
  const [preferences, setPreferences] = useState<PlanRequest | null>(() =>
    userId ? readUserCache<PlanRequest | null>(CACHE_KEY, userId, null) : null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && preferences) writeUserCache(CACHE_KEY, userId, preferences);
  }, [userId, preferences]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("workout_plan_preferences")
      .select(SELECT)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) return reportError(error, "usePlanPreferences");
        setPreferences((data as PlanRequest | null) ?? DEFAULT_PREFERENCES);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Saving is best effort: the form still works if it fails.
  const save = useCallback(
    async (next: PlanRequest) => {
      if (!userId || (preferences && same(preferences, next))) return;
      setPreferences(next);
      const { error } = await supabase.from("workout_plan_preferences").upsert({
        user_id: userId,
        ...next,
        updated_at: new Date().toISOString(),
      });
      if (error) reportError(error, "usePlanPreferences");
    },
    [userId, preferences],
  );

  return { preferences, loading, save };
}
