import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { flushDeletes, notDeleted, queueDelete } from "../functions/undoDelete";

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

const readCache = (userId: string) =>
  readUserCache<Exercise[]>(CACHE_KEY, userId, []);

const writeCache = (userId: string, value: Exercise[]) =>
  writeUserCache(CACHE_KEY, userId, value);

const nameKey = (name: string) => name.trim().toLowerCase();

const fetchAll = () => supabase.from("exercises").select(SELECT).order("name");

export default function useExercises(userId?: string) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    userId ? readCache(userId) : [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAll().then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error(error);
        setError("Couldn't load the exercise library.");
        return;
      }
      const fresh = (data as Exercise[]).filter(notDeleted("exercises"));
      setExercises(fresh);
      writeCache(userId, fresh);
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

  // Your own edits. A built-in exercise can't be changed, so editing one
  // saves your own copy and moves your sets over to it.
  const updateExercise = useCallback(
    async (exercise: Exercise, changes: NewExercise) => {
      if (!userId) return null;
      setError(null);
      const nameTaken = (e: { code?: string }) =>
        setError(
          e.code === "23505"
            ? "You already have an exercise with that name."
            : "Couldn't save that exercise.",
        );
      if (!exercise.user_id) {
        const { data, error } = await supabase
          .from("exercises")
          .insert({
            ...changes,
            equipment: exercise.equipment,
            steps: exercise.steps,
            user_id: userId,
          })
          .select(SELECT)
          .single();
        if (error) {
          console.error(error);
          nameTaken(error);
          return null;
        }
        const copy = data as Exercise;
        const moved = await supabase
          .from("workout_sets")
          .update({ exercise_id: copy.id })
          .eq("exercise_id", exercise.id);
        if (moved.error) console.error(moved.error);
        update((prev) => [...prev, copy].sort(byName));
        return copy;
      }
      const { data, error } = await supabase
        .from("exercises")
        .update(changes)
        .eq("id", exercise.id)
        .select(SELECT)
        .single();
      if (error) {
        console.error(error);
        nameTaken(error);
        return null;
      }
      const saved = data as Exercise;
      update((prev) =>
        prev.map((e) => (e.id === saved.id ? saved : e)).sort(byName),
      );
      return saved;
    },
    [userId, update],
  );

  // Case-insensitive name lookup, so logged sets can link to the library.
  // Your own exercise wins over a built-in one with the same name.
  const byLowerName = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const e of exercises) if (!e.user_id) map.set(nameKey(e.name), e);
    for (const e of exercises) if (e.user_id) map.set(nameKey(e.name), e);
    return map;
  }, [exercises]);

  // New names being saved, so quick sets of a new exercise share one entry.
  const pending = useRef(
    new Map<string, { id: string; saved: Promise<string | null> }>(),
  );

  // The library exercise for a name typed in a workout. A name that isn't in
  // the library yet becomes your own exercise: its id is known right away so
  // the set can show linked, and `saved` settles on the id to store (null if
  // the exercise couldn't be saved).
  const ensureExercise = useCallback(
    (name: string, unilateral: boolean) => {
      const key = nameKey(name);
      const found = byLowerName.get(key);
      if (found) return { id: found.id, saved: Promise.resolve(found.id) };
      const inFlight = pending.current.get(key);
      if (inFlight || !userId) return inFlight ?? null;
      const exercise: Exercise = {
        id: crypto.randomUUID(),
        user_id: userId,
        name: name.trim(),
        category: "strength",
        purposes: [],
        body_regions: [],
        dosage: null,
        equipment: null,
        description: null,
        steps: [],
        unilateral,
      };
      update((prev) => [...prev, exercise].sort(byName));
      const saved = (async () => {
        // A same-named exercise waiting behind an Undo toast would block
        // the insert; let its delete go out first.
        await flushDeletes();
        const { error } = await supabase.from("exercises").insert(exercise);
        if (!error) return exercise.id;
        // Already saved from another device: use that one.
        const { data } = await fetchAll();
        const all = (data ?? []) as Exercise[];
        const existing = all.find(
          (e) => e.user_id === userId && nameKey(e.name) === key,
        );
        if (!existing) console.error(error);
        update((prev) =>
          existing ? all : prev.filter((e) => e.id !== exercise.id),
        );
        return existing?.id ?? null;
      })().finally(() => pending.current.delete(key));
      const entry = { id: exercise.id, saved };
      pending.current.set(key, entry);
      return entry;
    },
    [userId, byLowerName, update],
  );

  const removeExercise = useCallback(
    (exercise: Exercise) => {
      update((prev) => prev.filter((e) => e.id !== exercise.id));
      setError(null);
      queueDelete({
        message: `${exercise.name} deleted`,
        rows: [`exercises:${exercise.id}`],
        commit: () => supabase.from("exercises").delete().eq("id", exercise.id),
        undo: () =>
          update((prev) =>
            prev.some((e) => e.id === exercise.id)
              ? prev
              : [...prev, exercise].sort(byName),
          ),
        onError: (error) => {
          console.error(error);
          setError("Couldn't delete that exercise.");
        },
      });
    },
    [update],
  );

  return {
    exercises,
    byLowerName,
    loading,
    error,
    dismissError: () => setError(null),
    addExercise,
    updateExercise,
    ensureExercise,
    removeExercise,
  };
}
