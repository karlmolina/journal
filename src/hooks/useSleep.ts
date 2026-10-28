import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { notDeleted, queueDelete } from "../functions/undoDelete";
import { reportError } from "../functions/reportError";
import { fromDbTime, toDbTime } from "../functions/sleep";

export interface SleepNight {
  id: string;
  // Local date of the evening the night started, YYYY-MM-DD.
  night: string;
  quality: number;
  // Minutes after midnight.
  bedtime: number;
  woke_at: number;
  // How long it took to fall asleep; not counted as sleep.
  fall_asleep_minutes: number;
}

export type NightInput = Omit<SleepNight, "id">;

interface Row {
  id: string;
  night: string;
  quality: number;
  bedtime: string;
  woke_at: string;
  fall_asleep_minutes: number;
}

const CACHE_KEY = "sleep_nights";

const fromRow = (r: Row): SleepNight => ({
  ...r,
  bedtime: fromDbTime(r.bedtime),
  woke_at: fromDbTime(r.woke_at),
});

// Newest night first.
const sortNights = (nights: SleepNight[]) =>
  [...nights].sort((a, b) => b.night.localeCompare(a.night));

export default function useSleep(userId?: string) {
  // Nights cached before fall_asleep_minutes existed count it as 0.
  const [nights, setNights] = useState<SleepNight[]>(() =>
    userId
      ? readUserCache<SleepNight[]>(CACHE_KEY, userId, []).map((n) => ({
          ...n,
          fall_asleep_minutes: n.fall_asleep_minutes ?? 0,
        }))
      : [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(nights);
  useEffect(() => {
    latest.current = nights;
    if (userId) writeUserCache(CACHE_KEY, userId, nights);
  }, [userId, nights]);

  const fail = useCallback((message: string, err: unknown) => {
    reportError(err, message);
    setError(message);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("sleep_nights")
      .select("id, night, quality, bedtime, woke_at, fall_asleep_minutes")
      .order("night", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) return fail("Couldn't load your sleep.", error);
        setNights(
          (data as Row[]).filter(notDeleted("sleep_nights")).map(fromRow),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [userId, fail]);

  // One entry per night; saving the same night again replaces it.
  const saveNight = useCallback(
    async (input: NightInput) => {
      const before = latest.current;
      const existing = before.find((n) => n.night === input.night);
      const night: SleepNight = {
        ...input,
        id: existing?.id ?? crypto.randomUUID(),
      };
      setNights(
        sortNights([...before.filter((n) => n.night !== input.night), night]),
      );
      setError(null);
      const { error } = await supabase.from("sleep_nights").upsert(
        {
          ...night,
          bedtime: toDbTime(night.bedtime),
          woke_at: toDbTime(night.woke_at),
        },
        { onConflict: "user_id,night" },
      );
      if (error) {
        setNights((prev) =>
          sortNights([
            ...prev.filter((n) => n.night !== input.night),
            ...(existing ? [existing] : []),
          ]),
        );
        fail("Couldn't save that night.", error);
      }
    },
    [fail],
  );

  const removeNight = useCallback(
    (id: string) => {
      const night = latest.current.find((n) => n.id === id);
      if (!night) return;
      setNights((prev) => prev.filter((n) => n.id !== id));
      setError(null);
      queueDelete({
        message: "Night deleted",
        rows: [`sleep_nights:${id}`],
        commit: () => supabase.from("sleep_nights").delete().eq("id", id),
        undo: () =>
          setNights((prev) =>
            prev.some((n) => n.id === id || n.night === night.night)
              ? prev
              : sortNights([...prev, night]),
          ),
        onError: (error) => fail("Couldn't delete that night.", error),
      });
    },
    [fail],
  );

  return {
    nights,
    loading,
    error,
    dismissError: () => setError(null),
    saveNight,
    removeNight,
  };
}
