import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { notDeleted, queueDelete } from "../functions/undoDelete";
import { reportError } from "../functions/reportError";
import { fromDbTime, minutesBefore, toDbTime } from "../functions/sleep";

// Nights cached before get-ready and tech-free became minutes held clock
// times; turn those into minutes before bedtime.
type CachedNight = SleepNight & {
  get_ready_at?: number | null;
  tech_free_at?: number | null;
};
const cachedMinutes = (
  minutes: number | null | undefined,
  time: number | null | undefined,
  bedtime: number,
) =>
  minutes !== undefined
    ? minutes
    : time === undefined || time === null
      ? null
      : minutesBefore(time, bedtime);

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
  // Minutes before bedtime that getting ready for bed started; null when not
  // logged.
  get_ready_minutes: number | null;
  // Minutes before bedtime that screens were put away; null when not logged.
  tech_free_minutes: number | null;
  // Time in bed after waking up, before getting up; counts as time in bed,
  // not as sleep.
  out_of_bed_minutes: number;
  // Time spent awake during the night; not counted as sleep.
  awake_minutes: number;
  notes: string;
}

export type NightInput = Omit<SleepNight, "id">;

interface Row {
  id: string;
  night: string;
  quality: number;
  bedtime: string;
  woke_at: string;
  fall_asleep_minutes: number;
  get_ready_minutes: number | null;
  tech_free_minutes: number | null;
  out_of_bed_minutes: number;
  awake_minutes: number;
  notes: string;
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
  // Nights cached before the newer fields existed get their defaults.
  const [nights, setNights] = useState<SleepNight[]>(() =>
    userId
      ? readUserCache<CachedNight[]>(CACHE_KEY, userId, []).map(
          ({ get_ready_at, tech_free_at, ...n }) => ({
            ...n,
            fall_asleep_minutes: n.fall_asleep_minutes ?? 0,
            get_ready_minutes: cachedMinutes(
              n.get_ready_minutes,
              get_ready_at,
              n.bedtime,
            ),
            tech_free_minutes: cachedMinutes(
              n.tech_free_minutes,
              tech_free_at,
              n.bedtime,
            ),
            out_of_bed_minutes: n.out_of_bed_minutes ?? 0,
            awake_minutes: n.awake_minutes ?? 0,
            notes: n.notes ?? "",
          }),
        )
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
      .select(
        "id, night, quality, bedtime, woke_at, fall_asleep_minutes, get_ready_minutes, tech_free_minutes, out_of_bed_minutes, awake_minutes, notes",
      )
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
