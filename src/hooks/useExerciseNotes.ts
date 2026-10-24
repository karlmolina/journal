import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

// Your own notes on exercises, by lowercased exercise name.
export type ExerciseNotes = Record<string, string>;

const CACHE_KEY = "exercise_notes";

export const noteKey = (exercise: string) => exercise.trim().toLowerCase();

function readCache(userId: string): ExerciseNotes {
  try {
    return JSON.parse(localStorage.getItem(`${CACHE_KEY}_${userId}`) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(userId: string, notes: ExerciseNotes) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(notes));
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export default function useExerciseNotes(userId?: string) {
  const [notes, setNotes] = useState<ExerciseNotes>(() =>
    userId ? readCache(userId) : {},
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("exercise_notes")
      .select("exercise_key, note")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setError("Couldn't load your exercise notes.");
          return;
        }
        const next = Object.fromEntries(
          data.map((n) => [n.exercise_key as string, n.note as string]),
        );
        setNotes(next);
        writeCache(userId, next);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    (fn: (prev: ExerciseNotes) => ExerciseNotes) =>
      setNotes((prev) => {
        const next = fn(prev);
        if (userId) writeCache(userId, next);
        return next;
      }),
    [userId],
  );

  // Saves the note for an exercise; an empty note deletes it.
  const saveNote = useCallback(
    async (exercise: string, note: string) => {
      const key = noteKey(exercise);
      if (!userId || !key) return;
      const text = note.trim();
      const before = notes[key];
      update((prev) => {
        const next = { ...prev };
        if (text) next[key] = text;
        else delete next[key];
        return next;
      });
      setError(null);
      const { error } = text
        ? await supabase.from("exercise_notes").upsert({
            user_id: userId,
            exercise_key: key,
            note: text,
            updated_at: new Date().toISOString(),
          })
        : await supabase
            .from("exercise_notes")
            .delete()
            .eq("user_id", userId)
            .eq("exercise_key", key);
      if (error) {
        console.error(error);
        update((prev) => {
          const next = { ...prev };
          if (before) next[key] = before;
          else delete next[key];
          return next;
        });
        setError("Couldn't save that note.");
      }
    },
    [userId, notes, update],
  );

  const noteFor = useCallback(
    (exercise: string) => notes[noteKey(exercise)],
    [notes],
  );

  return {
    noteFor,
    saveNote,
    error,
    dismissError: () => setError(null),
  };
}
