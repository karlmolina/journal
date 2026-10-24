import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_name: string;
  // The library exercise this set was, if any.
  exercise_id: string | null;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface Workout {
  id: string;
  started_at: string;
  paused_at: string | null;
  paused_seconds: number;
  ended_at: string | null;
  notes: string | null;
  // The plan and session (an index into its sessions) this workout follows.
  plan_id: string | null;
  plan_session: number | null;
  workout_sets: WorkoutSet[];
}

export interface PlanSessionRef {
  plan_id: string;
  plan_session: number;
}

export type NewSet = Pick<
  WorkoutSet,
  "exercise_name" | "exercise_id" | "reps" | "weight" | "duration_seconds"
>;

// What the set form collects; the library link is filled in from the name.
export type SetInput = Omit<NewSet, "exercise_id">;

const CACHE_KEY = "workouts";
const HISTORY_LIMIT = 20;
const SELECT =
  "id, started_at, paused_at, paused_seconds, ended_at, notes, plan_id, plan_session, workout_sets (id, workout_id, exercise_name, exercise_id, reps, weight, duration_seconds, created_at)";

// Stopwatch time: wall time since the start, minus time spent paused.
export function elapsedSeconds(w: Workout, now = Date.now()) {
  const end = w.ended_at ?? w.paused_at;
  const until = end ? Date.parse(end) : now;
  return Math.max(
    0,
    Math.floor((until - Date.parse(w.started_at)) / 1000) - w.paused_seconds,
  );
}

const pauseLength = (w: Workout, now: number) =>
  w.paused_at
    ? Math.max(0, Math.round((now - Date.parse(w.paused_at)) / 1000))
    : 0;

// Postgres returns numerics as strings; normalize so the UI can do math.
const normalize = (w: Workout): Workout => ({
  ...w,
  workout_sets: [...w.workout_sets]
    .map((s) => ({ ...s, weight: s.weight === null ? null : Number(s.weight) }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at)),
});

interface Cached {
  active: Workout | null;
  history: Workout[];
}

function readCache(userId: string): Cached {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {
    // Fall through to an empty cache.
  }
  return { active: null, history: [] };
}

function writeCache(userId: string, value: Cached) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export default function useWorkouts(userId?: string) {
  // Seeded from the cache so a running stopwatch shows on the first paint.
  const [active, setActive] = useState<Workout | null>(() =>
    userId ? readCache(userId).active : null,
  );
  const [history, setHistory] = useState<Workout[]>(() =>
    userId ? readCache(userId).history : [],
  );
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest state reachable from async callbacks, and mirror it to
  // the cache whenever it changes.
  const state = useRef({ active, history });
  useEffect(() => {
    state.current = { active, history };
    if (userId) writeCache(userId, { active, history });
  }, [userId, active, history]);

  const fail = useCallback((message: string, err: unknown) => {
    console.error(err);
    setError(message);
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [activeRes, historyRes] = await Promise.all([
      supabase
        .from("workouts")
        .select(SELECT)
        .is("ended_at", null)
        .maybeSingle(),
      supabase
        .from("workouts")
        .select(SELECT)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);
    setLoading(false);
    if (activeRes.error || historyRes.error) {
      fail("Couldn't load your workouts.", activeRes.error ?? historyRes.error);
      return;
    }
    setActive(activeRes.data ? normalize(activeRes.data as Workout) : null);
    setHistory((historyRes.data as Workout[]).map(normalize));
    setHasMore(historyRes.data.length === HISTORY_LIMIT);
  }, [userId, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    const oldest = state.current.history.at(-1);
    if (!oldest) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workouts")
      .select(SELECT)
      .not("ended_at", "is", null)
      .lt("started_at", oldest.started_at)
      .order("started_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    setLoading(false);
    if (error) return fail("Couldn't load older workouts.", error);
    setHistory((prev) => [...prev, ...(data as Workout[]).map(normalize)]);
    setHasMore(data.length === HISTORY_LIMIT);
  }, [fail]);

  // Writes are applied locally first so the stopwatch reacts instantly; a
  // failed write puts the previous state back.
  const updateActive = useCallback(
    async (changes: Partial<Workout>, message: string) => {
      const prev = state.current.active;
      if (!prev) return;
      const next = { ...prev, ...changes };
      setActive(next.ended_at ? null : next);
      if (next.ended_at) setHistory((h) => [next, ...h]);
      setError(null);
      const { error } = await supabase
        .from("workouts")
        .update(changes)
        .eq("id", prev.id);
      if (error) {
        setActive(prev);
        if (next.ended_at) setHistory((h) => h.filter((w) => w.id !== prev.id));
        fail(message, error);
      }
    },
    [fail],
  );

  const start = useCallback(
    async (planned?: PlanSessionRef) => {
      if (state.current.active) return;
      const workout: Workout = {
        id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        paused_at: null,
        paused_seconds: 0,
        ended_at: null,
        notes: null,
        plan_id: planned?.plan_id ?? null,
        plan_session: planned?.plan_session ?? null,
        workout_sets: [],
      };
      setActive(workout);
      setError(null);
      const { error } = await supabase.from("workouts").insert({
        id: workout.id,
        started_at: workout.started_at,
        plan_id: workout.plan_id,
        plan_session: workout.plan_session,
      });
      if (error) {
        setActive(null);
        // Most likely a workout was started on another device; show that one.
        fail("Couldn't start the workout.", error);
        load();
      }
    },
    [fail, load],
  );

  const pause = useCallback(() => {
    updateActive(
      { paused_at: new Date().toISOString() },
      "Couldn't pause the stopwatch.",
    );
  }, [updateActive]);

  const resume = useCallback(() => {
    const w = state.current.active;
    if (!w?.paused_at) return;
    updateActive(
      {
        paused_at: null,
        paused_seconds: w.paused_seconds + pauseLength(w, Date.now()),
      },
      "Couldn't resume the stopwatch.",
    );
  }, [updateActive]);

  const finish = useCallback(
    (notes: string) => {
      const w = state.current.active;
      if (!w) return;
      const now = Date.now();
      // A pause still running at the end doesn't count toward the time.
      updateActive(
        {
          paused_at: null,
          paused_seconds: w.paused_seconds + pauseLength(w, now),
          ended_at: new Date(now).toISOString(),
          notes: notes.trim() || null,
        },
        "Couldn't finish the workout.",
      );
    },
    [updateActive],
  );

  const discard = useCallback(async () => {
    const prev = state.current.active;
    if (!prev) return;
    setActive(null);
    setError(null);
    const { error } = await supabase
      .from("workouts")
      .delete()
      .eq("id", prev.id);
    if (error) {
      setActive(prev);
      fail("Couldn't discard the workout.", error);
    }
  }, [fail]);

  const removeWorkout = useCallback(
    async (id: string) => {
      const prev = state.current.history;
      setHistory(prev.filter((w) => w.id !== id));
      setError(null);
      const { error } = await supabase.from("workouts").delete().eq("id", id);
      if (error) {
        setHistory(prev);
        fail("Couldn't delete the workout.", error);
      }
    },
    [fail],
  );

  const setSets = (
    workoutId: string,
    update: (s: WorkoutSet[]) => WorkoutSet[],
  ) =>
    setActive((w) =>
      w && w.id === workoutId
        ? { ...w, workout_sets: update(w.workout_sets) }
        : w,
    );

  const addSet = useCallback(
    async (set: NewSet) => {
      const w = state.current.active;
      if (!w) return;
      const row: WorkoutSet = {
        ...set,
        id: crypto.randomUUID(),
        workout_id: w.id,
        created_at: new Date().toISOString(),
      };
      setSets(w.id, (sets) => [...sets, row]);
      setError(null);
      const { error } = await supabase.from("workout_sets").insert(row);
      if (error) {
        setSets(w.id, (sets) => sets.filter((s) => s.id !== row.id));
        fail("Couldn't save that set.", error);
      }
    },
    [fail],
  );

  const removeSet = useCallback(
    async (set: WorkoutSet) => {
      setSets(set.workout_id, (sets) => sets.filter((s) => s.id !== set.id));
      setError(null);
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", set.id);
      if (error) {
        setSets(set.workout_id, (sets) =>
          [...sets, set].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          ),
        );
        fail("Couldn't delete that set.", error);
      }
    },
    [fail],
  );

  // Sets can be corrected in the running workout and in past ones.
  const updateSet = useCallback(
    async (set: WorkoutSet, changes: Partial<NewSet>) => {
      const replace = (next: WorkoutSet) => (w: Workout) =>
        w.id === set.workout_id
          ? {
              ...w,
              workout_sets: w.workout_sets.map((s) =>
                s.id === set.id ? next : s,
              ),
            }
          : w;
      const apply = (next: WorkoutSet) => {
        setActive((w) => (w ? replace(next)(w) : w));
        setHistory((h) => h.map(replace(next)));
      };
      apply({ ...set, ...changes });
      setError(null);
      const { error } = await supabase
        .from("workout_sets")
        .update(changes)
        .eq("id", set.id);
      if (error) {
        apply(set);
        fail("Couldn't update that set.", error);
      }
    },
    [fail],
  );

  return {
    active,
    history,
    loading,
    hasMore,
    error,
    dismissError: () => setError(null),
    loadMore,
    start,
    pause,
    resume,
    finish,
    discard,
    removeWorkout,
    addSet,
    updateSet,
    removeSet,
  };
}
