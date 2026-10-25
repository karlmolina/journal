import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";

// One of your own dated notes on an exercise, optionally about an injury.
export interface ExerciseNoteEntry {
  id: string;
  // Lowercased exercise name, the same way sets are matched to exercises.
  exercise_key: string;
  exercise_name: string;
  note: string;
  injury_id: string | null;
  created_at: string;
}

export type NoteChanges = Partial<
  Pick<ExerciseNoteEntry, "note" | "injury_id">
>;

const CACHE_KEY = "exercise_note_entries";
const SELECT = "id, exercise_key, exercise_name, note, injury_id, created_at";

export const noteKey = (exercise: string) => exercise.trim().toLowerCase();

const newestFirst = (a: ExerciseNoteEntry, b: ExerciseNoteEntry) =>
  b.created_at.localeCompare(a.created_at);

const readCache = (userId: string) =>
  readUserCache<ExerciseNoteEntry[]>(CACHE_KEY, userId, []);

const writeCache = (userId: string, value: ExerciseNoteEntry[]) =>
  writeUserCache(CACHE_KEY, userId, value);

export default function useExerciseNotes(userId?: string) {
  // Newest first.
  const [entries, setEntries] = useState<ExerciseNoteEntry[]>(() =>
    userId ? readCache(userId) : [],
  );
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(entries);
  useEffect(() => {
    latest.current = entries;
    if (userId) writeCache(userId, entries);
  }, [userId, entries]);

  const fail = useCallback((message: string, err: unknown) => {
    console.error(err);
    setError(message);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("exercise_notes")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return fail("Couldn't load your exercise notes.", error);
        setEntries(data as ExerciseNoteEntry[]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, fail]);

  const byExercise = useMemo(() => {
    const map = new Map<string, ExerciseNoteEntry[]>();
    for (const e of entries) {
      const list = map.get(e.exercise_key);
      if (list) list.push(e);
      else map.set(e.exercise_key, [e]);
    }
    return map;
  }, [entries]);

  const byInjury = useMemo(() => {
    const map = new Map<string, ExerciseNoteEntry[]>();
    for (const e of entries) {
      if (!e.injury_id) continue;
      const list = map.get(e.injury_id);
      if (list) list.push(e);
      else map.set(e.injury_id, [e]);
    }
    return map;
  }, [entries]);

  const addNote = useCallback(
    async (exercise: string, note: string, injuryId: string | null) => {
      const key = noteKey(exercise);
      const text = note.trim();
      if (!userId || !key || !text) return;
      const entry: ExerciseNoteEntry = {
        id: crypto.randomUUID(),
        exercise_key: key,
        exercise_name: exercise.trim(),
        note: text,
        injury_id: injuryId,
        created_at: new Date().toISOString(),
      };
      setEntries((prev) => [entry, ...prev]);
      setError(null);
      const { error } = await supabase
        .from("exercise_notes")
        .insert({ ...entry, user_id: userId, updated_at: entry.created_at });
      if (error) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        fail("Couldn't save that note.", error);
      }
    },
    [userId, fail],
  );

  const updateNote = useCallback(
    async (id: string, changes: NoteChanges) => {
      const before = latest.current.find((e) => e.id === id);
      if (!before) return;
      const next =
        changes.note === undefined
          ? changes
          : { ...changes, note: changes.note.trim() };
      if (next.note === "") return;
      const replace = (entry: ExerciseNoteEntry) =>
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? entry : e)).sort(newestFirst),
        );
      replace({ ...before, ...next });
      setError(null);
      const { error } = await supabase
        .from("exercise_notes")
        .update({ ...next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        replace(before);
        fail("Couldn't save that note.", error);
      }
    },
    [fail],
  );

  const removeNote = useCallback(
    async (id: string) => {
      const prev = latest.current;
      setEntries(prev.filter((e) => e.id !== id));
      setError(null);
      const { error } = await supabase
        .from("exercise_notes")
        .delete()
        .eq("id", id);
      if (error) {
        setEntries(prev);
        fail("Couldn't delete that note.", error);
      }
    },
    [fail],
  );

  // Newest first.
  const notesFor = useCallback(
    (exercise: string) => byExercise.get(noteKey(exercise)) ?? [],
    [byExercise],
  );
  const notesForInjury = useCallback(
    (injuryId: string) => byInjury.get(injuryId) ?? [],
    [byInjury],
  );

  return {
    notesFor,
    notesForInjury,
    addNote,
    updateNote,
    removeNote,
    error,
    dismissError: () => setError(null),
  };
}

export type ExerciseNotes = ReturnType<typeof useExerciseNotes>;
