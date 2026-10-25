import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { flushDeletes, notDeleted, queueDelete } from "../functions/undoDelete";

export type Side = "left" | "right";

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_name: string;
  // The library exercise this set was, if any.
  exercise_id: string | null;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  // Which side, for exercises done one side at a time.
  side: Side | null;
  // Rest taken before this set, timed by the guided set timer.
  rest_seconds: number | null;
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
  // Supersets set up during this workout; null follows the plan's.
  supersets: string[][] | null;
  workout_sets: WorkoutSet[];
}

export interface PlanSessionRef {
  plan_id: string;
  plan_session: number;
}

export type NewSet = Pick<
  WorkoutSet,
  | "exercise_name"
  | "exercise_id"
  | "reps"
  | "weight"
  | "duration_seconds"
  | "side"
> &
  Partial<Pick<WorkoutSet, "rest_seconds">>;

// What the set form collects; the library link is filled in from the name.
export type SetInput = Omit<NewSet, "exercise_id">;

const CACHE_KEY = "workouts";
const HISTORY_LIMIT = 20;
const SELECT =
  "id, started_at, paused_at, paused_seconds, ended_at, notes, plan_id, plan_session, supersets, workout_sets (id, workout_id, exercise_name, exercise_id, reps, weight, duration_seconds, side, rest_seconds, created_at)";

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
// Sets waiting behind an Undo toast stay out, like the deleted set itself.
const normalize = (w: Workout): Workout => ({
  ...w,
  supersets: w.supersets ?? null,
  workout_sets: w.workout_sets
    .filter(notDeleted("workout_sets"))
    .map((s) => ({
      ...s,
      weight: s.weight === null ? null : Number(s.weight),
      side: s.side ?? null,
      rest_seconds: s.rest_seconds ?? null,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at)),
});

interface Cached {
  active: Workout | null;
  history: Workout[];
}

const readCache = (userId: string) =>
  readUserCache<Cached>(CACHE_KEY, userId, { active: null, history: [] });

const writeCache = (userId: string, value: Cached) =>
  writeUserCache(CACHE_KEY, userId, value);

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
    const fresh = (rows: Workout[]) =>
      rows.filter(notDeleted("workouts")).map(normalize);
    setActive(
      fresh(activeRes.data ? [activeRes.data as Workout] : [])[0] ?? null,
    );
    setHistory(fresh(historyRes.data as Workout[]));
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
    setHistory((prev) => [
      ...prev,
      ...(data as Workout[]).filter(notDeleted("workouts")).map(normalize),
    ]);
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
        supersets: null,
        workout_sets: [],
      };
      setActive(workout);
      setError(null);
      // A just-discarded workout still holds the one active slot until its
      // delete goes out.
      await flushDeletes();
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

  const setSupersets = useCallback(
    (supersets: string[][]) =>
      updateActive({ supersets }, "Couldn't save the superset."),
    [updateActive],
  );

  // Deletes wait behind an Undo toast; undo (or a failed delete) puts the
  // workout back where it was.
  const discard = useCallback(() => {
    const prev = state.current.active;
    if (!prev) return;
    setActive(null);
    setError(null);
    queueDelete({
      message: "Workout deleted",
      rows: [`workouts:${prev.id}`],
      commit: () => supabase.from("workouts").delete().eq("id", prev.id),
      undo: () => setActive((w) => w ?? prev),
      onError: (error) => fail("Couldn't discard the workout.", error),
    });
  }, [fail]);

  const removeWorkout = useCallback(
    (id: string) => {
      const prev = state.current.history;
      const workout = prev.find((w) => w.id === id);
      if (!workout) return;
      setHistory(prev.filter((w) => w.id !== id));
      setError(null);
      queueDelete({
        message: "Workout deleted",
        rows: [`workouts:${id}`],
        commit: () => supabase.from("workouts").delete().eq("id", id),
        undo: () =>
          setHistory((h) =>
            h.some((w) => w.id === id)
              ? h
              : [...h, workout].sort((a, b) =>
                  b.started_at.localeCompare(a.started_at),
                ),
          ),
        onError: (error) => fail("Couldn't delete the workout.", error),
      });
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

  // `linked` settles on the library exercise to store, when the set's
  // exercise is still being added to the library.
  const addSet = useCallback(
    async (set: NewSet, linked?: Promise<string | null>) => {
      const w = state.current.active;
      if (!w) return;
      let row: WorkoutSet = {
        rest_seconds: null,
        ...set,
        id: crypto.randomUUID(),
        workout_id: w.id,
        created_at: new Date().toISOString(),
      };
      setSets(w.id, (sets) => [...sets, row]);
      setError(null);
      if (linked) {
        const exercise_id = await linked;
        if (exercise_id !== row.exercise_id) {
          row = { ...row, exercise_id };
          setSets(w.id, (sets) =>
            sets.map((s) => (s.id === row.id ? { ...s, exercise_id } : s)),
          );
        }
      }
      const { error } = await supabase.from("workout_sets").insert(row);
      if (error) {
        setSets(w.id, (sets) => sets.filter((s) => s.id !== row.id));
        fail("Couldn't save that set.", error);
      }
    },
    [fail],
  );

  // Deletes one set, or every set of an exercise, from the running workout
  // or a past one. Undo puts them back in place.
  const removeSets = useCallback(
    (removed: WorkoutSet[]) => {
      if (removed.length === 0) return;
      const workoutId = removed[0].workout_id;
      const ids = new Set(removed.map((s) => s.id));
      const edit = (fn: (sets: WorkoutSet[]) => WorkoutSet[]) => {
        const apply = (w: Workout) =>
          w.id === workoutId ? { ...w, workout_sets: fn(w.workout_sets) } : w;
        setActive((w) => (w ? apply(w) : w));
        setHistory((h) => h.map(apply));
      };
      edit((sets) => sets.filter((s) => !ids.has(s.id)));
      setError(null);
      const one = removed.length === 1;
      queueDelete({
        message: one ? "Set deleted" : `${removed.length} sets deleted`,
        rows: removed.map((s) => `workout_sets:${s.id}`),
        commit: () =>
          supabase
            .from("workout_sets")
            .delete()
            .in("id", [...ids]),
        undo: () =>
          edit((sets) =>
            [
              ...sets,
              ...removed.filter((r) => !sets.some((s) => s.id === r.id)),
            ].sort((a, b) => a.created_at.localeCompare(b.created_at)),
          ),
        onError: (error) =>
          fail(
            one ? "Couldn't delete that set." : "Couldn't delete those sets.",
            error,
          ),
      });
    },
    [fail],
  );

  // Sets can be corrected in the running workout and in past ones.
  const updateSet = useCallback(
    async (
      set: WorkoutSet,
      changes: Partial<NewSet>,
      linked?: Promise<string | null>,
    ) => {
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
      if (linked) {
        const exercise_id = await linked;
        if (exercise_id !== changes.exercise_id) {
          changes = { ...changes, exercise_id };
          apply({ ...set, ...changes });
        }
      }
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

  // Turns one logged set into two, halving its time, for a set that should
  // have been recorded as two. The second half starts right after the first
  // with no rest. An Undo toast puts the one set back.
  const splitSet = useCallback(
    (set: WorkoutSet) => {
      const d = set.duration_seconds;
      const first: WorkoutSet = {
        ...set,
        duration_seconds: d === null ? null : Math.ceil(d / 2),
      };
      const second: WorkoutSet = {
        ...set,
        id: crypto.randomUUID(),
        duration_seconds: d === null ? null : Math.floor(d / 2) || null,
        rest_seconds: null,
        created_at: new Date(Date.parse(set.created_at) + 1).toISOString(),
      };
      const edit = (fn: (sets: WorkoutSet[]) => WorkoutSet[]) => {
        const apply = (w: Workout) =>
          w.id === set.workout_id
            ? { ...w, workout_sets: fn(w.workout_sets) }
            : w;
        setActive((w) => (w ? apply(w) : w));
        setHistory((h) => h.map(apply));
      };
      const unsplit = () =>
        edit((sets) =>
          sets
            .filter((s) => s.id !== second.id)
            .map((s) => (s.id === set.id ? set : s)),
        );
      edit((sets) =>
        sets
          .flatMap((s) => (s.id === set.id ? [first, second] : [s]))
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      );
      setError(null);
      const saved = (async () => {
        const { error } = await supabase.from("workout_sets").insert(second);
        if (error) return error;
        return (
          await supabase
            .from("workout_sets")
            .update({ duration_seconds: first.duration_seconds })
            .eq("id", set.id)
        ).error;
      })().then((error) => {
        if (error) {
          unsplit();
          fail("Couldn't split that set.", error);
        }
        return !error;
      });
      queueDelete({
        message: "Set split",
        rows: [],
        commit: () => Promise.resolve({ error: null }),
        undo: async () => {
          unsplit();
          if (!(await saved)) return;
          const [del, upd] = await Promise.all([
            supabase.from("workout_sets").delete().eq("id", second.id),
            supabase
              .from("workout_sets")
              .update({ duration_seconds: set.duration_seconds })
              .eq("id", set.id),
          ]);
          if (del.error || upd.error)
            fail("Couldn't undo the split.", del.error ?? upd.error);
        },
        onError: (error) => fail("Couldn't split that set.", error),
      });
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
    setSupersets,
    removeWorkout,
    addSet,
    updateSet,
    removeSets,
    splitSet,
  };
}
