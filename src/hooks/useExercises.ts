import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export type ExerciseCategory =
  | "mobility"
  | "stability"
  | "strength"
  | "stretch";
export type ExercisePurpose = "healing" | "prevention";

export interface Exercise {
  id: string;
  // Null for the built-in library.
  user_id: string | null;
  name: string;
  category: ExerciseCategory;
  purposes: ExercisePurpose[];
  body_regions: string[];
  dosage: string | null;
  equipment: string | null;
  description: string | null;
  steps: string[];
  // Done one side at a time, so workouts alternate left and right sets.
  unilateral: boolean;
}

export type NewExercise = Pick<
  Exercise,
  | "name"
  | "category"
  | "purposes"
  | "body_regions"
  | "dosage"
  | "description"
  | "unilateral"
>;

const CACHE_KEY = "exercises";
const SELECT =
  "id, user_id, name, category, purposes, body_regions, dosage, equipment, description, steps, unilateral";

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name);

function readCache(userId: string): Exercise[] {
  try {
    return JSON.parse(localStorage.getItem(`${CACHE_KEY}_${userId}`) ?? "[]");
  } catch {
    return [];
  }
}

function writeCache(userId: string, exercises: Exercise[]) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(exercises));
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export default function useExercises(userId?: string) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    userId ? readCache(userId) : [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("exercises")
      .select(SELECT)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error(error);
          setError("Couldn't load the exercise library.");
          return;
        }
        setExercises(data as Exercise[]);
        writeCache(userId, data as Exercise[]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    (fn: (prev: Exercise[]) => Exercise[]) =>
      setExercises((prev) => {
        const next = fn(prev);
        if (userId) writeCache(userId, next);
        return next;
      }),
    [userId],
  );

  const addExercise = useCallback(
    async (exercise: NewExercise) => {
      if (!userId) return false;
      setError(null);
      const { data, error } = await supabase
        .from("exercises")
        .insert({ ...exercise, user_id: userId })
        .select(SELECT)
        .single();
      if (error) {
        console.error(error);
        setError(
          error.code === "23505"
            ? "You already have an exercise with that name."
            : "Couldn't save that exercise.",
        );
        return false;
      }
      update((prev) => [...prev, data as Exercise].sort(byName));
      return true;
    },
    [userId, update],
  );

  const removeExercise = useCallback(
    async (exercise: Exercise) => {
      update((prev) => prev.filter((e) => e.id !== exercise.id));
      setError(null);
      const { error } = await supabase
        .from("exercises")
        .delete()
        .eq("id", exercise.id);
      if (error) {
        console.error(error);
        update((prev) => [...prev, exercise].sort(byName));
        setError("Couldn't delete that exercise.");
      }
    },
    [update],
  );

  // Case-insensitive name lookup, so logged sets can link to the library.
  const byLowerName = useMemo(
    () => new Map(exercises.map((e) => [e.name.toLowerCase(), e])),
    [exercises],
  );

  return {
    exercises,
    byLowerName,
    loading,
    error,
    dismissError: () => setError(null),
    addExercise,
    removeExercise,
  };
}
